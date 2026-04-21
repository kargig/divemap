import {
  Card,
  Statistic,
  Row,
  Col,
  Tooltip,
  Progress,
  Typography,
  Divider,
  Empty,
  Tag,
} from 'antd';
import { format, subDays, isSameDay, parseISO, startOfWeek, addDays, getMonth } from 'date-fns';
import {
  Star,
  MapPin,
  MessageSquare,
  Calendar as CalendarIcon,
  Map,
  Activity,
  Building2,
  Users,
  Gauge,
  Cylinder,
  Timer,
  Shield,
  UserPlus,
  UserCheck,
  Clock,
  Notebook,
  History,
  Anchor,
  Shirt,
  TrendingUp,
  Wind,
  Droplets,
  Award,
  Trophy,
  Medal,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

import {
  getUserPublicProfile,
  getUserFriendships,
  sendFriendRequest,
  createChatRoom,
} from '../api';
import Avatar from '../components/Avatar';
import OrganizationLogo from '../components/OrganizationLogo';
import { getSocialMediaIcon } from '../components/SocialMediaIcons';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { formatGases } from '../utils/textHelpers';

const ActivityHeatmap = ({ data }) => {
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    // Start 364 days ago
    const startDate = subDays(today, 364);
    // Start on the Monday of that week to align columns
    const startOfGrid = startOfWeek(startDate, { weekStartsOn: 1 }); // 1 = Monday

    const weeksArray = [];
    const labels = [];
    let currentMonth = -1;

    for (let w = 0; w < 53; w++) {
      const weekDays = [];
      let weekHasNewMonth = false;
      let monthForLabel = null;

      for (let d = 0; d < 7; d++) {
        const date = addDays(startOfGrid, w * 7 + d);
        const dateStr = format(date, 'yyyy-MM-dd');
        const month = getMonth(date);

        // Check if the date is within the last 364 days + today
        const isOutOfRange = date < startDate || date > today;

        if (!isOutOfRange && month !== currentMonth) {
          currentMonth = month;
          weekHasNewMonth = true;
          monthForLabel = date; // Record the date to format the month label
        }

        weekDays.push({
          date,
          dateStr,
          count: isOutOfRange ? 0 : data[dateStr] || 0,
          isOutOfRange,
        });
      }

      if (weekHasNewMonth && monthForLabel) {
        // We only want to label the month if it started in this week
        labels.push({ weekIndex: w, monthName: format(monthForLabel, 'MMM') });
      }

      weeksArray.push(weekDays);
    }

    return { weeks: weeksArray, monthLabels: labels };
  }, [data]);

  const getColor = count => {
    if (count === 0) return 'bg-gray-100';
    if (count === 1) return 'bg-blue-200';
    if (count === 2) return 'bg-blue-400';
    if (count >= 3) return 'bg-blue-600';
    return 'bg-gray-100';
  };

  return (
    <div className='flex flex-col gap-1 overflow-x-auto pb-2'>
      {/* Months Row (With padding-left to account for day labels) */}
      <div className='flex relative h-4 text-xs text-gray-500 dark:text-gray-400 ml-8'>
        {monthLabels.map((label, index) => (
          <span
            key={index}
            className='absolute text-[10px]'
            style={{ left: `${label.weekIndex * 16}px` }} // w-3 (12px) + gap-1 (4px)
          >
            {label.monthName}
          </span>
        ))}
      </div>

      <div className='flex items-center gap-1'>
        {/* Day Labels Column - Exactly aligned to Mon and Sun rows */}
        <div className='flex flex-col justify-between h-[108px] w-7 text-[10px] text-gray-400 dark:text-gray-500 py-px'>
          <span>Mon</span>
          <span>Sun</span>
        </div>

        {/* Grid Body */}
        <div className='flex gap-1'>
          {weeks.map((week, wIndex) => (
            <div key={wIndex} className='flex flex-col gap-1'>
              {week.map(day =>
                day.isOutOfRange ? (
                  <div key={day.dateStr} className='w-3 h-3 rounded-sm bg-transparent' />
                ) : (
                  <Tooltip
                    key={day.dateStr}
                    title={`${day.count} dives on ${format(day.date, 'MMM d, yyyy')}`}
                  >
                    <div
                      className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors`}
                    />
                  </Tooltip>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const UserProfile = () => {
  // Set page title
  usePageTitle('Divemap - User Profile');
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [friendshipStatus, setFriendshipStatus] = useState(null); // null, 'PENDING', 'ACCEPTED'
  const [isProcessingFriendship, setIsProcessingFriendship] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getUserPublicProfile(username);
        setProfile(data);

        // Fetch friendship status if logged in and not viewing self
        if (currentUser && currentUser.username !== username) {
          try {
            const friends = await getUserFriendships('ACCEPTED');
            const isFriend = friends.some(
              f =>
                (f.user && f.user.username === username) ||
                (f.friend && f.friend.username === username)
            );
            if (isFriend) {
              setFriendshipStatus('ACCEPTED');
            } else {
              const pending = await getUserFriendships('PENDING');
              const isPending = pending.some(
                f =>
                  (f.user && f.user.username === username) ||
                  (f.friend && f.friend.username === username)
              );
              if (isPending) setFriendshipStatus('PENDING');
            }
          } catch (fErr) {
            console.error('Failed to fetch friendship status', fErr);
          }
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const handleBuddyAction = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (friendshipStatus === 'ACCEPTED') {
      // Logic to start chat
      try {
        const room = await createChatRoom([profile.id], false);
        navigate('/messages', { state: { roomId: room.id } });
      } catch (err) {
        toast.error('Failed to start chat');
      }
      return;
    }

    if (!friendshipStatus) {
      setIsProcessingFriendship(true);
      try {
        await sendFriendRequest(profile.id);
        setFriendshipStatus('PENDING');
        toast.success('Buddy request sent!');
      } catch (err) {
        toast.error('Failed to send buddy request');
      } finally {
        setIsProcessingFriendship(false);
      }
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-8'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-gray-900 mb-4'>
            {error === 'User not found' ? 'User Not Found' : 'Error'}
          </h1>
          <p className='text-gray-600 mb-6'>
            {error === 'User not found'
              ? `The user "${username}" could not be found.`
              : 'Something went wrong while loading the profile.'}
          </p>
          <Link
            to='/'
            className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const renderCertificationFeatures = cert => {
    if (!cert.certification_level_link) return null;

    const features = [];
    const { max_depth, gases, equipment, tanks, deco_time_limit } = cert.certification_level_link;

    if (max_depth) {
      let shortDepth = max_depth;
      const depthMatch = max_depth.match(/^(\d+)\s*m/i);
      if (depthMatch) {
        shortDepth = `${depthMatch[1]}m`;
      } else if (/^\d+$/.test(max_depth)) {
        shortDepth = `${max_depth}m`;
      }

      features.push({
        icon: <TrendingUp className='h-3 w-3' />,
        label: shortDepth,
        title: `Max Depth: ${max_depth}`,
        color: 'bg-blue-50 text-blue-700 border-blue-100',
      });
    }

    if (gases) {
      features.push({
        icon: <Wind className='h-3 w-3' />,
        label: formatGases(gases),
        title: `Gases: ${gases}`,
        color: 'bg-green-50 text-green-700 border-green-100',
      });
    }

    const tankInfo = tanks || equipment;
    if (tankInfo) {
      const isDoubles =
        tankInfo.toLowerCase().includes('double') || tankInfo.toLowerCase().includes('twin');
      features.push({
        icon: (
          <img
            src={isDoubles ? '/doubles.png' : '/single.png'}
            alt='tank'
            className='h-3.5 w-3.5 object-contain'
          />
        ),
        label: tankInfo,
        title: `Tanks/Equip: ${tankInfo}`,
        color: 'bg-purple-50 text-purple-700 border-purple-100',
      });
    }

    if (deco_time_limit) {
      features.push({
        icon: <Droplets className='h-3 w-3' />,
        label: `Deco: ${deco_time_limit}`,
        title: `Deco Limit: ${deco_time_limit}`,
        color: 'bg-red-50 text-red-700 border-red-100',
      });
    }

    if (features.length === 0) return null;

    return (
      <div className='flex flex-wrap gap-1.5 mt-2'>
        {features.map((f, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold ${f.color}`}
            title={f.title}
          >
            {f.icon}
            <span className='whitespace-nowrap'>{f.label}</span>
          </div>
        ))}
      </div>
    );
  };

  const totalDives =
    (profile.number_of_dives || 0) +
    (profile.stats?.dives_created || 0) +
    (profile.stats?.buddy_dives_count || 0);

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const StatCard = ({ icon, value, label, link, color, isSmall = false }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      purple: 'bg-purple-50 text-purple-600',
      orange: 'bg-orange-50 text-orange-600',
      yellow: 'bg-yellow-50 text-yellow-600',
      indigo: 'bg-indigo-50 text-indigo-600',
      teal: 'bg-teal-50 text-teal-600',
      cyan: 'bg-cyan-50 text-cyan-600',
      rose: 'bg-rose-50 text-rose-600',
      amber: 'bg-amber-50 text-amber-600',
      emerald: 'bg-emerald-50 text-emerald-600',
      violet: 'bg-violet-50 text-violet-600',
      fuchsia: 'bg-fuchsia-50 text-fuchsia-600',
    };

    const content = (
      <div
        className={`text-center ${isSmall ? 'p-1.5' : 'p-4'} ${colorClasses[color] || colorClasses.blue} rounded-lg ${link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
      >
        <div className={`flex items-center justify-center ${isSmall ? 'mb-0.5' : 'mb-2'}`}>
          {icon}
        </div>
        <div className={`${isSmall ? 'text-xs' : 'text-xl'} font-bold break-words leading-tight`}>
          {value}
        </div>
        <div
          className={`${isSmall ? 'text-[9px]' : 'text-sm'} text-gray-600 ${isSmall ? 'mt-0' : 'mt-1'} uppercase tracking-tighter opacity-70`}
        >
          {label}
        </div>
      </div>
    );

    if (link) {
      return <Link to={link}>{content}</Link>;
    }

    return content;
  };

  const CertificationStats = ({ stats, isEmbedded = false }) => {
    if (!stats) return null;
    // Don't render if all stats are empty
    if (
      !stats.max_depth_str &&
      (!stats.best_gases || stats.best_gases.length === 0) &&
      (!stats.largest_tanks || stats.largest_tanks.length === 0) &&
      !stats.max_deco_time
    ) {
      return null;
    }

    // Format Best Gas
    let bestGasValue = 'Air';
    if (stats.max_trimix_pct) {
      bestGasValue = `Trimix (${stats.max_trimix_pct})`;
    } else if (stats.max_nitrox_pct > 21) {
      bestGasValue = `Nitrox ${stats.max_nitrox_pct}%`;
    } else if (stats.best_gases && stats.best_gases.length > 0) {
      bestGasValue = stats.best_gases[0];
    }

    // Format Best Tanks
    let bestTanksValue = 'Single';
    if (stats.largest_tanks && stats.largest_tanks.length > 0) {
      bestTanksValue = stats.largest_tanks[0];
    }
    const isDoubles = (() => {
      const n = String(bestTanksValue).toLowerCase();
      return (
        n.includes('double') ||
        n.includes('twin') ||
        n.startsWith('d') ||
        ['14', '16', '20', '24', '30'].includes(n)
      );
    })();

    if (stats.max_stages > 0) {
      bestTanksValue += ` + ${stats.max_stages} Stg`;
    }

    return (
      <div
        className={
          isEmbedded
            ? 'mt-4 lg:mt-0'
            : 'bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-100'
        }
      >
        {!isEmbedded && (
          <h2 className='text-xl font-semibold text-gray-900 mb-4 uppercase tracking-tight'>
            Certification Level Overview
          </h2>
        )}
        <div
          className={`grid ${isEmbedded ? 'grid-cols-2 lg:grid-cols-4 gap-3' : 'grid-cols-2 md:grid-cols-4 gap-4'}`}
        >
          {stats.max_depth_str && (
            <StatCard
              icon={
                <TrendingUp className={`${isEmbedded ? 'h-4 w-4' : 'h-6 w-6'} text-blue-600`} />
              }
              value={stats.max_depth_str}
              label='Max Depth'
              color='blue'
              isSmall={isEmbedded}
            />
          )}

          <StatCard
            icon={<Wind className={`${isEmbedded ? 'h-4 w-4' : 'h-6 w-6'} text-green-600`} />}
            value={formatGases(bestGasValue)}
            label='Best Gas'
            color='green'
            isSmall={isEmbedded}
          />

          <StatCard
            icon={
              <img
                src={isDoubles ? '/doubles.png' : '/single.png'}
                alt='tank'
                className={`${isEmbedded ? 'h-6 w-6' : 'h-8 w-8'} object-contain`}
              />
            }
            value={bestTanksValue}
            label='Best Tanks'
            color='amber'
            isSmall={isEmbedded}
          />

          {stats.max_deco_time && (
            <StatCard
              icon={<Droplets className={`${isEmbedded ? 'h-4 w-4' : 'h-6 w-6'} text-red-600`} />}
              value={stats.max_deco_time}
              label='Max Deco Time'
              color='rose'
              isSmall={isEmbedded}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
      {/* Header */}
      <div className='bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 border border-gray-100'>
        <div className='flex flex-col sm:flex-row items-center sm:items-start sm:space-x-6 w-full text-center sm:text-left gap-4'>
          <div className='shrink-0'>
            <Avatar
              src={profile.avatar_full_url}
              alt={profile.username}
              size='xl'
              className='sm:w-32 sm:h-32'
              fallbackText={profile.username}
            />
          </div>
          <div className='flex-1 min-w-0 w-full'>
            <div className='flex flex-col lg:flex-row justify-between items-center lg:items-start w-full gap-6 mb-4'>
              <div className='flex-1 min-w-0 text-center sm:text-left'>
                <h1 className='text-3xl sm:text-4xl font-bold text-gray-900 truncate mb-2'>
                  {profile.username}
                </h1>

                <div className='flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-2 text-gray-600 text-sm mb-4'>
                  <div className='flex items-center space-x-1'>
                    <Notebook className='h-4 w-4 text-blue-500' />
                    <span className='font-semibold'>{totalDives} dives</span>
                  </div>
                  <div className='flex items-center space-x-1'>
                    <CalendarIcon className='h-4 w-4 text-blue-500' />
                    <span>Joined {formatDate(profile.member_since)}</span>
                  </div>
                  <div className='flex items-center space-x-1'>
                    <Shield className='h-4 w-4 text-blue-500' />
                    <span className='font-medium'>
                      {profile.is_admin
                        ? 'Administrator'
                        : profile.is_moderator
                          ? 'Moderator'
                          : 'User'}
                    </span>
                  </div>
                  {profile.stats.total_points > 0 && (
                    <div className='flex items-center space-x-1'>
                      <Trophy className='h-4 w-4 text-yellow-500' />
                      <span className='font-bold text-blue-600'>
                        {profile.stats.total_points.toLocaleString()} points
                      </span>
                    </div>
                  )}
                  {profile.stats.leaderboard_rank && (
                    <div className='flex items-center space-x-1'>
                      <Medal className='h-4 w-4 text-amber-600' />
                      <span className='font-semibold'>Rank #{profile.stats.leaderboard_rank}</span>
                    </div>
                  )}
                </div>

                {/* Social Media Links */}
                {profile.social_links && profile.social_links.length > 0 && (
                  <div className='flex flex-wrap justify-center sm:justify-start gap-2'>
                    {profile.social_links.map(link => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target='_blank'
                        rel='noopener noreferrer nofollow'
                        className='group flex items-center bg-gray-50 hover:bg-white border border-gray-200 rounded-full px-3 py-1.5 transition-all shadow-sm hover:shadow-md'
                        title={link.platform}
                      >
                        <div className='group-hover:scale-110 transition-transform mr-1.5'>
                          {getSocialMediaIcon(link.platform, {
                            color: '000000',
                            className: 'w-4 h-4',
                          })}
                        </div>
                        <span className='font-bold text-xs text-gray-700 capitalize'>
                          {link.platform}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Certification Overview on the Right for Desktop */}
              <div className='hidden lg:block shrink-0'>
                <CertificationStats stats={profile.certification_stats} isEmbedded={true} />
              </div>

              {currentUser && currentUser.username !== username && (
                <div className='shrink-0 pt-1'>
                  <button
                    onClick={handleBuddyAction}
                    disabled={isProcessingFriendship || friendshipStatus === 'PENDING'}
                    className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm hover:shadow-md ${
                      friendshipStatus === 'ACCEPTED'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : friendshipStatus === 'PENDING'
                          ? 'bg-gray-100 text-gray-500 cursor-default shadow-none'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {friendshipStatus === 'ACCEPTED' ? (
                      <>
                        <MessageSquare size={18} />
                        <span>Message</span>
                      </>
                    ) : friendshipStatus === 'PENDING' ? (
                      <>
                        <Clock size={18} />
                        <span>Request Sent</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        <span>Add Buddy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Certification Overview - Only visible on small screens */}
      {profile.certification_stats && (
        <div className='lg:hidden mb-6'>
          <CertificationStats stats={profile.certification_stats} />
        </div>
      )}

      <div className='flex flex-col lg:grid lg:grid-cols-3 gap-6 sm:gap-8'>
        {/* Sidebar - Order 1 on mobile, Order 2 on desktop */}
        <div className='space-y-6 order-1 lg:order-2'>
          {/* Quick Stats */}
          <div className='bg-white rounded-lg shadow-md p-6 border border-gray-100'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
              <Gauge className='h-5 w-5 text-gray-400' />
              Community Impact
            </h3>
            <div className='space-y-3'>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <Notebook size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Total Dives:</span>
                </div>
                <span className='font-semibold flex-1 text-right'>{totalDives}</span>
              </div>
              {profile.stats.total_points > 0 && (
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-2'>
                    <Trophy size={16} className='text-yellow-500' />
                    <span className='text-gray-600'>Total Points:</span>
                  </div>
                  <span className='font-bold text-blue-600 flex-1 text-right'>
                    {profile.stats.total_points.toLocaleString()}
                  </span>
                </div>
              )}
              {profile.stats.leaderboard_rank && (
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-2'>
                    <Medal size={16} className='text-amber-600' />
                    <span className='text-gray-600'>Leaderboard Rank:</span>
                  </div>
                  <div className='flex-1 text-right'>
                    <Link to='/leaderboard' className='font-semibold text-blue-600 hover:underline'>
                      #{profile.stats.leaderboard_rank}
                    </Link>
                  </div>
                </div>
              )}
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <Activity size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dives Created:</span>
                </div>
                <div className='flex-1 text-right'>
                  {profile.stats.dives_created > 0 ? (
                    <Link
                      to={`/dives?username=${profile.username}`}
                      className='text-blue-600 hover:underline font-semibold'
                    >
                      {profile.stats.dives_created}
                    </Link>
                  ) : (
                    <span className='font-semibold'>{profile.stats.dives_created}</span>
                  )}
                </div>
              </div>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <Users size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dives as Buddy:</span>
                </div>
                <div className='flex-1 text-right'>
                  {profile.stats.buddy_dives_count > 0 ? (
                    <Link
                      to={`/dives?buddy_username=${profile.username}`}
                      className='text-blue-600 hover:underline font-semibold'
                    >
                      {profile.stats.buddy_dives_count}
                    </Link>
                  ) : (
                    <span className='font-semibold'>{profile.stats.buddy_dives_count}</span>
                  )}
                </div>
              </div>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <MapPin size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dive Sites Created:</span>
                </div>
                <div className='flex-1 text-right'>
                  {profile.stats.dive_sites_created > 0 ? (
                    <Link
                      to={`/dive-sites?created_by_username=${profile.username}`}
                      className='text-blue-600 hover:underline font-semibold'
                    >
                      {profile.stats.dive_sites_created}
                    </Link>
                  ) : (
                    <span className='font-semibold'>{profile.stats.dive_sites_created}</span>
                  )}
                </div>
              </div>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <Star size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dive Site Ratings:</span>
                </div>
                <span className='font-semibold flex-1 text-right'>
                  {profile.stats.site_ratings_count}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <MessageSquare size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dive Site Comments:</span>
                </div>
                <span className='font-semibold flex-1 text-right'>
                  {profile.stats.site_comments_count}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <Building2 size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Diving Centers Owned:</span>
                </div>
                <span className='font-semibold flex-1 text-right'>
                  {profile.stats.diving_centers_owned}
                </span>
              </div>
              <div className='flex justify-between items-center border-t pt-2 mt-2'>
                <div className='flex items-center gap-2'>
                  <CalendarIcon size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Member Since:</span>
                </div>
                <span className='font-semibold flex-1 text-right'>
                  {formatDate(profile.member_since)}
                </span>
              </div>
            </div>
          </div>

          {/* Certifications in Sidebar for Desktop */}
          {profile.certifications && profile.certifications.length > 0 && (
            <div className='hidden lg:block bg-white rounded-lg shadow-md p-6 border border-gray-100'>
              <h2 className='text-lg font-bold text-gray-900 mb-4 uppercase tracking-tight flex items-center gap-2'>
                <Award className='h-5 w-5 text-gray-400' />
                Certifications
              </h2>
              <div className='space-y-4'>
                {profile.certifications.map((cert, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg ${
                      cert.is_active
                        ? 'border-green-100 bg-green-50/30'
                        : 'border-gray-100 bg-gray-50/30'
                    }`}
                  >
                    <div className='flex items-start gap-3'>
                      <div className='shrink-0'>
                        <Link
                          to={`/resources/diving-organizations?org=${encodeURIComponent(cert.diving_organization.acronym || cert.diving_organization.name)}&course=${encodeURIComponent(cert.certification_level)}`}
                          className='block'
                          title={`View ${cert.diving_organization.acronym} details`}
                        >
                          <OrganizationLogo
                            org={cert.diving_organization}
                            size='h-10 w-10'
                            textSize='text-[10px]'
                          />
                        </Link>
                      </div>
                      <div className='flex-1 min-w-0'>
                        <Link
                          to={`/resources/diving-organizations?org=${encodeURIComponent(cert.diving_organization.acronym || cert.diving_organization.name)}&course=${encodeURIComponent(cert.certification_level)}`}
                          className='block group'
                        >
                          <div className='flex items-center space-x-1.5 mb-1'>
                            <div
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                cert.is_active
                                  ? 'bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.5)]'
                                  : 'bg-gray-400'
                              }`}
                            />
                            <span className='font-bold text-gray-900 leading-tight text-xs group-hover:text-blue-600 transition-colors'>
                              {cert.diving_organization.acronym} - {cert.certification_level}
                            </span>
                          </div>
                        </Link>
                        {renderCertificationFeatures(cert)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No certifications message */}
          {(!profile.certifications || profile.certifications.length === 0) && (
            <div className='bg-white rounded-lg shadow-md p-6 border border-gray-100'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Certifications</h3>
              <p className='text-gray-600 text-sm'>No certifications listed yet.</p>
            </div>
          )}
        </div>

        {/* Main Content - Order 2 on mobile, Order 1 on desktop */}
        <div className='lg:col-span-2 space-y-6 order-2 lg:order-1'>
          {/* Hero Stats */}
          {profile.diving_stats && (
            <div className='bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-100'>
              <h2 className='text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2'>
                <Notebook className='h-5 w-5 text-blue-600' />
                Diving Logbook Summary
              </h2>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={8}>
                  <Card
                    variant='borderless'
                    className='bg-blue-50 text-center hover:shadow-sm transition-shadow'
                    styles={{ body: { padding: '12px 8px' } }}
                  >
                    <Statistic
                      title={
                        <span className='text-[10px] uppercase tracking-wide opacity-70'>
                          Max Depth
                        </span>
                      }
                      value={profile.diving_stats.max_depth || 0}
                      suffix={<span className='text-xs font-normal opacity-50'>m</span>}
                      precision={1}
                      prefix={<TrendingUp className='h-3.5 w-3.5 inline mr-1 text-blue-500' />}
                      styles={{ content: { fontSize: '18px', fontWeight: 'bold' } }}
                    />
                  </Card>
                </Col>
                <Col xs={12} md={8}>
                  <Card
                    variant='borderless'
                    className='bg-indigo-50 text-center hover:shadow-sm transition-shadow'
                    styles={{ body: { padding: '12px 8px' } }}
                  >
                    <Statistic
                      title={
                        <span className='text-[10px] uppercase tracking-wide opacity-70'>
                          Longest Dive
                        </span>
                      }
                      value={profile.diving_stats.longest_dive_minutes || 0}
                      suffix={<span className='text-xs font-normal opacity-50'>min</span>}
                      prefix={<Clock className='h-3.5 w-3.5 inline mr-1 text-indigo-500' />}
                      styles={{ content: { fontSize: '18px', fontWeight: 'bold' } }}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card
                    variant='borderless'
                    className='bg-teal-50 text-center hover:shadow-sm transition-shadow'
                    styles={{ body: { padding: '12px 8px' } }}
                  >
                    <Statistic
                      title={
                        <span className='text-[10px] uppercase tracking-wide opacity-70'>
                          Total Time
                        </span>
                      }
                      value={profile.diving_stats.total_bottom_time_minutes || 0}
                      suffix={<span className='text-xs font-normal opacity-50'>min</span>}
                      prefix={<Clock className='h-3.5 w-3.5 inline mr-1 text-teal-500' />}
                      styles={{ content: { fontSize: '18px', fontWeight: 'bold' } }}
                    />
                    <div className='text-[10px] text-gray-500 mt-1 opacity-70 uppercase tracking-tighter'>
                      ≈ {Math.round((profile.diving_stats.total_bottom_time_minutes || 0) / 60)}{' '}
                      hours
                    </div>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                {/* Favorite Sites */}
                <div>
                  <h3 className='text-lg font-medium text-gray-800 mb-4 flex items-center gap-2'>
                    <MapPin className='h-4 w-4 text-blue-500' />
                    Favorite Dive Sites
                  </h3>
                  {profile.diving_stats.favorite_sites?.length > 0 ? (
                    <div className='space-y-2'>
                      {profile.diving_stats.favorite_sites.map((site, index) => (
                        <div
                          key={site.id}
                          className='flex items-center justify-between w-full py-2'
                        >
                          <Link
                            to={`/dive-sites/${site.id}`}
                            className='text-blue-600 hover:underline font-medium'
                          >
                            {index + 1}. {site.name}
                          </Link>
                          <Tag color='blue'>{site.visit_count} visits</Tag>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='No sites logged yet' />
                  )}
                </div>

                {/* Suit & Gear Preferences */}
                <div>
                  <h3 className='text-lg font-medium text-gray-800 mb-4 flex items-center gap-2'>
                    <Shirt className='h-4 w-4 text-blue-500' />
                    Suit & Gear Preferences
                  </h3>
                  <div className='space-y-6'>
                    {/* Suit Stats */}
                    {Object.keys(profile.diving_stats.suit_preferences || {}).length > 0 && (
                      <div className='space-y-3'>
                        <span className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
                          Suits
                        </span>
                        {Object.entries(profile.diving_stats.suit_preferences).map(
                          ([suit, count]) => {
                            const total = Object.values(
                              profile.diving_stats.suit_preferences
                            ).reduce((a, b) => a + b, 0);
                            const percent = Math.round((count / total) * 100);
                            const labelMap = {
                              wet_suit: 'Wetsuit',
                              dry_suit: 'Drysuit',
                              shortie: 'Shortie',
                            };
                            return (
                              <div key={suit}>
                                <div className='flex justify-between mb-1 text-sm'>
                                  <span className='text-gray-600 font-medium'>
                                    {labelMap[suit] || suit}
                                  </span>
                                  <span className='text-gray-400'>{count} dives</span>
                                </div>
                                <Progress
                                  percent={percent}
                                  size='small'
                                  strokeColor={suit === 'dry_suit' ? '#1890ff' : '#40a9ff'}
                                />
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}

                    {/* Gear Stats */}
                    {Object.keys(profile.diving_stats.gear_preferences || {}).length > 0 && (
                      <div className='space-y-3'>
                        <span className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
                          Tanks
                        </span>
                        {Object.entries(profile.diving_stats.gear_preferences).map(
                          ([gear, count]) => {
                            const total = Object.values(
                              profile.diving_stats.gear_preferences
                            ).reduce((a, b) => a + b, 0);
                            const percent = Math.round((count / total) * 100);
                            const n = gear.toLowerCase();
                            const isDoubles =
                              n.includes('double') ||
                              n.includes('twin') ||
                              n.startsWith('d') ||
                              ['14', '16', '20', '24', '30'].includes(n);
                            const hasStage = n.includes('stage') || n.includes('+');

                            return (
                              <div key={gear}>
                                <div className='flex justify-between mb-1 text-sm'>
                                  <div className='flex items-center gap-1.5'>
                                    <img
                                      src={isDoubles ? '/doubles.png' : '/single.png'}
                                      className='h-3.5 w-3.5 object-contain opacity-70'
                                      alt=''
                                    />
                                    <span className='text-gray-600 font-medium'>{gear}</span>
                                  </div>
                                  <span className='text-gray-400'>{count} dives</span>
                                </div>
                                <Progress
                                  percent={percent}
                                  size='small'
                                  strokeColor={
                                    hasStage ? '#722ed1' : isDoubles ? '#13c2c2' : '#faad14'
                                  }
                                />
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}

                    {Object.keys(profile.diving_stats.suit_preferences || {}).length === 0 &&
                      Object.keys(profile.diving_stats.gear_preferences || {}).length === 0 && (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description='No data available'
                        />
                      )}
                  </div>
                </div>
              </div>

              <Divider />

              {/* Activity Heatmap */}
              <div>
                <div className='flex justify-between items-center mb-4'>
                  <h3 className='text-lg font-medium text-gray-800 flex items-center gap-2 m-0'>
                    <CalendarIcon className='h-4 w-4 text-blue-500' />
                    Diving Activity (Last 365 Days)
                  </h3>
                  {profile.diving_stats.most_active_month && (
                    <Tooltip title='All-time personal record'>
                      <Tag
                        color='orange'
                        className='mr-0 border-none px-3 py-1 flex items-center gap-2'
                      >
                        <Star className='w-3 h-3' />
                        <span className='text-xs uppercase font-bold tracking-wider'>Record:</span>
                        <span className='text-xs font-semibold'>
                          {profile.diving_stats.most_active_month}
                        </span>
                      </Tag>
                    </Tooltip>
                  )}
                </div>
                <ActivityHeatmap data={profile.diving_stats.activity_heatmap || {}} />
                <div className='flex items-center justify-end gap-2 mt-2 text-xs text-gray-400'>
                  <span>Less</span>
                  <div className='w-2.5 h-2.5 rounded-sm bg-gray-100' />
                  <div className='w-2.5 h-2.5 rounded-sm bg-blue-200' />
                  <div className='w-2.5 h-2.5 rounded-sm bg-blue-400' />
                  <div className='w-2.5 h-2.5 rounded-sm bg-blue-600' />
                  <span>More</span>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Certifications (hidden on lg) */}
          {profile.certifications && profile.certifications.length > 0 && (
            <div className='lg:hidden bg-white rounded-lg shadow-md p-4 border border-gray-100 mt-6'>
              <h2 className='text-lg font-bold text-gray-900 mb-4 uppercase tracking-tight'>
                Certifications
              </h2>
              <div className='space-y-3'>
                {profile.certifications.map((cert, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg ${
                      cert.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className='flex items-start gap-3'>
                      <div className='shrink-0'>
                        <Link
                          to={`/resources/diving-organizations?org=${encodeURIComponent(cert.diving_organization.acronym || cert.diving_organization.name)}&course=${encodeURIComponent(cert.certification_level)}`}
                          className='block'
                          title={`View ${cert.diving_organization.acronym} details`}
                        >
                          <OrganizationLogo
                            org={cert.diving_organization}
                            size='h-10 w-10'
                            textSize='text-[10px]'
                          />
                        </Link>
                      </div>
                      <div className='flex-1 min-w-0'>
                        <Link
                          to={`/resources/diving-organizations?org=${encodeURIComponent(cert.diving_organization.acronym || cert.diving_organization.name)}&course=${encodeURIComponent(cert.certification_level)}`}
                          className='block group'
                        >
                          <div className='flex items-center space-x-1.5 mb-1'>
                            <div
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                cert.is_active ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                            <span className='font-bold text-gray-900 text-xs uppercase group-hover:text-blue-600 transition-colors'>
                              {cert.diving_organization.acronym} - {cert.certification_level}
                            </span>
                          </div>
                        </Link>
                        {renderCertificationFeatures(cert)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
