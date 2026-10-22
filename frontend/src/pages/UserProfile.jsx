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
  User,
  UserPlus,
  UserCheck,
  Clock,
  Notebook,
  History,
  Anchor,
  Shirt,
  TrendingUp,
  ArrowUpRight,
  Wind,
  Droplets,
  Award,
  Trophy,
  Medal,
  Globe,
  Bookmark,
  Eye,
  FolderHeart,
  Loader2,
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
  getUserPublicLists,
} from '../api';
import Avatar from '../components/Avatar';
import OrganizationLogo from '../components/OrganizationLogo';
import DiverCapabilityRibbon from '../components/profile/DiverCapabilityRibbon';
import DiverCommunityGrid from '../components/profile/DiverCommunityGrid';
import SEO from '../components/SEO';
import { getSocialMediaIcon } from '../components/SocialMediaIcons';
import DepthIcon from '../components/ui/DepthIcon';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateHelpers';
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
      <div className='flex relative h-4 text-xs text-gray-500 dark:text-gray-400 ml-[26px]'>
        {monthLabels.map((label, index) => (
          <span
            key={index}
            className='absolute text-[10px]'
            style={{ left: `${label.weekIndex * 12}px` }} // w-2.5 (10px) + gap-0.5 (2px)
          >
            {label.monthName}
          </span>
        ))}
      </div>

      <div className='flex items-center gap-0.5'>
        {/* Day Labels Column - Exactly aligned to Mon and Sun rows */}
        <div className='flex flex-col justify-between h-[82px] w-6 text-[10px] text-gray-400 dark:text-gray-500 py-px'>
          <span>Mon</span>
          <span>Sun</span>
        </div>

        {/* Grid Body */}
        <div className='flex gap-0.5'>
          {weeks.map((week, wIndex) => (
            <div key={wIndex} className='flex flex-col gap-0.5'>
              {week.map(day =>
                day.isOutOfRange ? (
                  <div key={day.dateStr} className='w-2.5 h-2.5 rounded-sm bg-transparent' />
                ) : (
                  <Tooltip
                    key={day.dateStr}
                    title={`${day.count} dives on ${format(day.date, 'MMM d, yyyy')}`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-sm ${getColor(day.count)} transition-colors`}
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
  const { username, tab } = useParams();
  const navigate = useNavigate();
  const validTabs = useMemo(
    () => ['overview', 'activity', 'certifications', 'collections', 'travel'],
    []
  );

  const activeTab = useMemo(() => {
    if (!tab || tab === 'overview') return 'overview';
    if (tab === 'travel') return 'collections';
    return validTabs.includes(tab) ? tab : 'overview';
  }, [tab, validTabs]);

  const handleTabChange = newTab => {
    if (newTab === activeTab) return;
    const targetUrl = newTab === 'overview' ? `/users/${username}` : `/users/${username}/${newTab}`;
    navigate(targetUrl);
  };

  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [friendshipStatus, setFriendshipStatus] = useState(null); // null, 'PENDING', 'ACCEPTED'
  const [isProcessingFriendship, setIsProcessingFriendship] = useState(false);
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getUserPublicProfile(username);
        setProfile(data);

        // Fetch lists
        try {
          const listsData = await getUserPublicLists(username);
          setLists(listsData);
        } catch (listsErr) {
          console.error('Failed to fetch user public lists:', listsErr);
        } finally {
          setLoadingLists(false);
        }

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
        icon: <DepthIcon className='text-divemap-blue font-bold' size={14} />,
        label: shortDepth,
        title: `Max Depth: ${max_depth}`,
        color: 'bg-blue-50 text-divemap-blue border-blue-100',
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

  const StatCard = ({ icon, value, label, link, color, isSmall = false }) => {
    const colorClasses = {
      blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40',
      green:
        'bg-green-50 dark:bg-emerald-950/40 text-green-600 dark:text-emerald-300 border border-green-100 dark:border-emerald-900/40',
      purple:
        'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40',
      orange:
        'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 border border-orange-100 dark:border-orange-900/40',
      yellow:
        'bg-yellow-50 dark:bg-amber-950/40 text-yellow-600 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-900/40',
      indigo:
        'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40',
      teal: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-300 border border-teal-100 dark:border-teal-900/40',
      cyan: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-300 border border-cyan-100 dark:border-cyan-900/40',
      rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40',
      amber:
        'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40',
      emerald:
        'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40',
      violet:
        'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 border border-violet-100 dark:border-violet-900/40',
      fuchsia:
        'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-100 dark:border-fuchsia-900/40',
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
          className={`${isSmall ? 'text-[9px]' : 'text-sm'} text-gray-600 dark:text-slate-300 ${isSmall ? 'mt-0' : 'mt-1'} uppercase tracking-tighter opacity-70`}
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
            : 'bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 sm:p-6 mb-6 border border-gray-100 dark:border-slate-700'
        }
      >
        {!isEmbedded && (
          <h2 className='text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4 uppercase tracking-tight'>
            Certification Level Overview
          </h2>
        )}
        <div
          className={`grid ${isEmbedded ? 'grid-cols-2 lg:grid-cols-4 gap-3' : 'grid-cols-2 md:grid-cols-4 gap-4'}`}
        >
          {stats.max_depth_str && (
            <StatCard
              icon={<DepthIcon className='text-divemap-blue' size={isEmbedded ? 16 : 24} />}
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
    <>
      <SEO
        title={`${profile?.name || username} - Diver Profile | Divemap`}
        description={`View the public dive profile, logged dives, statistics, and certifications for ${profile?.name || username} on Divemap.`}
        type='profile'
      />
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
        {/* Header */}
        <div className='bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 sm:p-6 mb-6 border border-gray-100 dark:border-slate-700'>
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
                  <h1 className='text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 truncate mb-2'>
                    {profile.username}
                  </h1>

                  <div className='flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-2 text-gray-600 dark:text-slate-400 text-sm mb-4'>
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
                        <span className='font-bold text-blue-600 dark:text-sky-400'>
                          {profile.stats.total_points.toLocaleString()} points
                        </span>
                      </div>
                    )}
                    {profile.stats.leaderboard_rank && (
                      <div className='flex items-center space-x-1'>
                        <Medal className='h-4 w-4 text-amber-600' />
                        <span className='font-semibold'>
                          Rank #{profile.stats.leaderboard_rank}
                        </span>
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
                          className='group flex items-center bg-gray-50 dark:bg-slate-700/60 hover:bg-white dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full px-3 py-1.5 transition-all shadow-sm hover:shadow-md'
                          title={link.platform}
                        >
                          <div className='group-hover:scale-110 transition-transform mr-1.5'>
                            {getSocialMediaIcon(link.platform, {
                              color: '000000',
                              className: 'w-4 h-4',
                            })}
                          </div>
                          <span className='font-bold text-xs text-gray-700 dark:text-slate-200 capitalize'>
                            {link.platform}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
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

        {/* Diver Capability Ribbon - Disambiguates Depth, Deco, Gas, Rig, Thermal */}
        <DiverCapabilityRibbon profile={profile} />

        {/* Navigation Tabs (Overview, Diving Activity, Certifications, Collections) */}
        <div
          className='flex flex-wrap gap-1.5 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl mb-6 border border-gray-200/80 dark:border-slate-700'
          role='tablist'
        >
          <button
            type='button'
            role='tab'
            aria-selected={activeTab === 'overview'}
            onClick={() => handleTabChange('overview')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <User size={15} />
            <span>Overview</span>
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={activeTab === 'activity'}
            onClick={() => handleTabChange('activity')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'activity'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CalendarIcon size={15} />
            <span>Diving Activity</span>
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={activeTab === 'certifications'}
            onClick={() => handleTabChange('certifications')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'certifications'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Award size={15} />
            <span>Certifications ({profile.certifications?.length || 0})</span>
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={activeTab === 'collections'}
            onClick={() => handleTabChange('collections')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'collections'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Bookmark size={15} />
            <span>Collections ({lists.length || 0})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8'>
            {/* Left 2 Cols: Diving Logbook Summary + Suit & Gear + Favorite Sites */}
            <div className='lg:col-span-2 space-y-6'>
              {profile.diving_stats && (
                <div className='bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 dark:border-slate-700'>
                  <h2 className='text-base font-bold uppercase tracking-tight text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2'>
                    <Notebook className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                    Diving Logbook Summary
                  </h2>
                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <div className='bg-blue-50 dark:bg-slate-700/60 p-3.5 rounded-lg text-center border border-blue-100/80 dark:border-slate-600/40 hover:shadow-sm transition-shadow'>
                      <div className='text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-slate-400 mb-1'>
                        Deepest Dive Logged
                      </div>
                      <div className='text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center justify-center gap-1.5'>
                        <DepthIcon className='inline text-divemap-blue' size={18} />
                        <span>
                          {profile.diving_stats.max_depth
                            ? `${parseFloat(profile.diving_stats.max_depth).toFixed(1)}m`
                            : '0m'}
                        </span>
                      </div>
                    </div>

                    <div className='bg-indigo-50 dark:bg-slate-700/60 p-3.5 rounded-lg text-center border border-indigo-100/80 dark:border-slate-600/40 hover:shadow-sm transition-shadow'>
                      <div className='text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-slate-400 mb-1'>
                        Longest Dive
                      </div>
                      <div className='text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center justify-center gap-1.5'>
                        <Clock className='h-4 w-4 inline text-indigo-500' />
                        <span>{profile.diving_stats.longest_dive_minutes || 0} min</span>
                      </div>
                    </div>

                    <div className='bg-teal-50 dark:bg-slate-700/60 p-3.5 rounded-lg text-center border border-teal-100/80 dark:border-slate-600/40 hover:shadow-sm transition-shadow'>
                      <div className='text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-slate-400 mb-1'>
                        Total Bottom Time
                      </div>
                      <div className='text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center justify-center gap-1.5'>
                        <Clock className='h-4 w-4 inline text-teal-500' />
                        <span>
                          {(profile.diving_stats.total_bottom_time_minutes || 0).toLocaleString()}{' '}
                          min
                        </span>
                      </div>
                      <div className='text-[10px] text-gray-500 dark:text-slate-400 mt-1 uppercase font-semibold'>
                        ≈ {Math.round((profile.diving_stats.total_bottom_time_minutes || 0) / 60)}{' '}
                        hours
                      </div>
                    </div>
                  </div>

                  <Divider className='dark:border-slate-700 my-5' />

                  {/* Suit & Gear Preferences (Concept 1: Stacked Segmented Distribution Bars) */}
                  <div>
                    <h3 className='text-base font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2'>
                      <Shirt className='h-4 w-4 text-blue-500' />
                      Suit &amp; Gear Preferences
                    </h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6'>
                      {/* Suit Segmented Distribution */}
                      {(() => {
                        const suits = profile.diving_stats.suit_preferences || {};
                        const suitTotal = Object.values(suits).reduce((a, b) => a + b, 0);
                        if (suitTotal === 0) return null;
                        const labelMap = {
                          wet_suit: 'Wetsuit',
                          dry_suit: 'Drysuit',
                          shortie: 'Shortie',
                        };
                        const colorMap = {
                          dry_suit: '#0284c7', // sky-600
                          wet_suit: '#3b82f6', // blue-500
                          shortie: '#06b6d4', // cyan-500
                        };
                        const segments = Object.entries(suits)
                          .map(([suit, count]) => ({
                            key: suit,
                            label: labelMap[suit] || suit,
                            count,
                            pct: Math.round((count / suitTotal) * 100),
                            color: colorMap[suit] || '#60a5fa',
                          }))
                          .sort((a, b) => b.count - a.count);

                        return (
                          <div className='p-3.5 rounded-lg bg-gray-50/60 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between'>
                            <div>
                              <div className='flex items-center justify-between mb-2'>
                                <span className='text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest'>
                                  Thermal Exposure
                                </span>
                                <span className='text-[11px] text-gray-400 dark:text-slate-400 font-medium'>
                                  {suitTotal} dives
                                </span>
                              </div>

                              {/* Multi-segment Bar */}
                              <div className='h-2.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner'>
                                {segments.map(s => (
                                  <div
                                    key={s.key}
                                    style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                                    className='h-full transition-all duration-300'
                                    title={`${s.label}: ${s.count} dives (${s.pct}%)`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Legend */}
                            <div className='flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700/40 text-xs'>
                              {segments.map(s => (
                                <div key={s.key} className='flex items-center gap-1.5'>
                                  <span
                                    className='w-2 h-2 rounded-full shrink-0'
                                    style={{ backgroundColor: s.color }}
                                  />
                                  <span className='font-medium text-gray-700 dark:text-slate-200'>
                                    {s.label}
                                  </span>
                                  <span className='text-[11px] text-gray-400 dark:text-slate-400 font-semibold'>
                                    {s.pct}%{' '}
                                    <span className='opacity-70 font-normal'>({s.count})</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Tank Segmented Distribution */}
                      {(() => {
                        const gears = profile.diving_stats.gear_preferences || {};
                        const gearTotal = Object.values(gears).reduce((a, b) => a + b, 0);
                        if (gearTotal === 0) return null;
                        const getColor = name => {
                          const n = name.toLowerCase();
                          if (n.includes('stage') || n.includes('+')) return '#a855f7'; // purple-500
                          if (n.includes('double') || n.includes('twin')) return '#10b981'; // emerald-500
                          if (n.includes('side')) return '#06b6d4'; // cyan-500
                          return '#f59e0b'; // amber-500 for singles
                        };
                        const segments = Object.entries(gears)
                          .map(([gear, count]) => ({
                            key: gear,
                            label: gear,
                            count,
                            pct: Math.round((count / gearTotal) * 100),
                            color: getColor(gear),
                          }))
                          .sort((a, b) => b.count - a.count);

                        return (
                          <div className='p-3.5 rounded-lg bg-gray-50/60 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between'>
                            <div>
                              <div className='flex items-center justify-between mb-2'>
                                <span className='text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest'>
                                  Cylinder Setup
                                </span>
                                <span className='text-[11px] text-gray-400 dark:text-slate-400 font-medium'>
                                  {gearTotal} dives
                                </span>
                              </div>

                              {/* Multi-segment Bar */}
                              <div className='h-2.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner'>
                                {segments.map(s => (
                                  <div
                                    key={s.key}
                                    style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                                    className='h-full transition-all duration-300'
                                    title={`${s.label}: ${s.count} dives (${s.pct}%)`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Legend */}
                            <div className='flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700/40 text-xs'>
                              {segments.map(s => (
                                <div key={s.key} className='flex items-center gap-1.5'>
                                  <span
                                    className='w-2 h-2 rounded-full shrink-0'
                                    style={{ backgroundColor: s.color }}
                                  />
                                  <span className='font-medium text-gray-700 dark:text-slate-200'>
                                    {s.label}
                                  </span>
                                  <span className='text-[11px] text-gray-400 dark:text-slate-400 font-semibold'>
                                    {s.pct}%{' '}
                                    <span className='opacity-70 font-normal'>({s.count})</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Favorite Dive Sites (Below Suit & Gear, Way More Compact) */}
                  <div className='mt-5 pt-4 border-t border-gray-100 dark:border-slate-700/60'>
                    <div className='flex items-center justify-between mb-2.5'>
                      <h4 className='text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5'>
                        <MapPin className='h-3.5 w-3.5 text-blue-500' />
                        Favorite Dive Sites
                      </h4>
                      {profile.diving_stats.favorite_sites?.length > 0 && (
                        <span className='text-[11px] text-gray-400 dark:text-slate-500'>
                          Top {profile.diving_stats.favorite_sites.length} most visited
                        </span>
                      )}
                    </div>

                    {profile.diving_stats.favorite_sites?.length > 0 ? (
                      <div className='flex flex-wrap gap-2'>
                        {profile.diving_stats.favorite_sites.map((site, index) => (
                          <Link
                            key={site.id}
                            to={`/dive-sites/${site.id}`}
                            className='inline-flex items-center gap-2 py-1.5 px-3 rounded-lg bg-gray-50/80 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-600/40 text-xs font-semibold text-gray-800 dark:text-slate-200 transition-all hover:scale-[1.01] group'
                          >
                            <span className='w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-sky-300 text-[10px] font-bold flex items-center justify-center shrink-0'>
                              {index + 1}
                            </span>
                            <span className='group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors'>
                              {site.name}
                            </span>
                            <span className='px-1.5 py-0.5 rounded text-[10px] bg-blue-100/70 dark:bg-blue-950/50 text-blue-700 dark:text-sky-300 font-bold'>
                              {site.visit_count}x
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className='text-xs text-gray-400 dark:text-slate-500 italic'>
                        No favorite dive sites logged yet
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right 1 Col: Community Impact */}
            <div className='space-y-6'>
              <DiverCommunityGrid profile={profile} />
            </div>
          </div>
        )}

        {/* TAB 2: DIVING ACTIVITY */}
        {activeTab === 'activity' && (
          <div className='space-y-6'>
            {profile.diving_stats && (
              <div className='bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 dark:border-slate-700'>
                <div className='flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-slate-700/60'>
                  <h3 className='text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 m-0 uppercase tracking-tight'>
                    <CalendarIcon className='h-5 w-5 text-blue-500' />
                    Diving Activity (Last 365 Days)
                  </h3>
                  {profile.diving_stats.most_active_month && (
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
                  )}
                </div>
                <ActivityHeatmap data={profile.diving_stats.activity_heatmap || {}} />
                <div className='flex items-center justify-end gap-2 mt-3 text-xs text-gray-400'>
                  <span>Less</span>
                  <div className='w-2.5 h-2.5 rounded-sm bg-gray-100' />
                  <div className='w-2.5 h-2.5 rounded-sm bg-blue-200' />
                  <div className='w-2.5 h-2.5 rounded-sm bg-blue-400' />
                  <div className='w-2.5 h-2.5 rounded-sm bg-blue-600' />
                  <span>More</span>
                </div>
              </div>
            )}

            {/* Fancy Analytics Link */}
            <Link to={`/users/${username}/analytics`} className='block group'>
              <div className='relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 shadow-lg transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-xl border border-blue-500/30'>
                <div className='absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all duration-500'></div>
                <div className='relative flex items-center justify-between z-10'>
                  <div className='flex items-center gap-4'>
                    <div className='p-3 bg-white/20 rounded-lg backdrop-blur-sm'>
                      <TrendingUp className='w-8 h-8 text-white' />
                    </div>
                    <div>
                      <h3 className='text-xl font-bold text-white mb-1 tracking-wide'>
                        Advanced Analytics
                      </h3>
                      <p className='text-blue-100 text-sm font-medium'>
                        Explore SAC rates, depth density, and thermal preferences
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white group-hover:bg-white/20 group-hover:translate-x-1 transition-all duration-300'>
                    <ArrowUpRight className='w-5 h-5' />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* TAB 3: CERTIFICATIONS */}
        {activeTab === 'certifications' && (
          <div className='bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-slate-700'>
            <h2 className='text-lg font-bold text-gray-900 dark:text-slate-100 mb-6 uppercase tracking-tight flex items-center gap-2 border-b border-gray-100 dark:border-slate-700/60 pb-3'>
              <Award className='h-5 w-5 text-blue-500' />
              Diving Certifications &amp; Qualifications
            </h2>
            {profile.certifications && profile.certifications.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {profile.certifications.map((cert, index) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-xl transition-all ${
                      cert.is_active
                        ? 'border-green-200 dark:border-emerald-800/60 bg-green-50/20 dark:bg-emerald-950/20'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30'
                    }`}
                  >
                    <div className='flex items-start gap-3.5'>
                      <div className='shrink-0'>
                        <Link
                          to={`/resources/diving-organizations?org=${encodeURIComponent(cert.diving_organization.acronym || cert.diving_organization.name)}&course=${encodeURIComponent(cert.certification_level)}`}
                          className='block'
                          title={`View ${cert.diving_organization.acronym} details`}
                        >
                          <OrganizationLogo
                            org={cert.diving_organization}
                            size='h-12 w-12'
                            textSize='text-xs'
                          />
                        </Link>
                      </div>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center space-x-2 mb-1.5'>
                          <div
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              cert.is_active
                                ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                                : 'bg-gray-400'
                            }`}
                          />
                          <span className='font-bold text-gray-900 dark:text-slate-100 text-sm'>
                            {cert.diving_organization.acronym} - {cert.certification_level}
                          </span>
                        </div>
                        {renderCertificationFeatures(cert)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-gray-500 dark:text-slate-400 text-sm'>
                No certifications listed yet.
              </p>
            )}
          </div>
        )}

        {/* TAB 4: COLLECTIONS */}
        {activeTab === 'collections' && (
          <div className='bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-slate-700'>
            <h2 className='text-lg font-bold text-gray-900 dark:text-slate-100 mb-6 uppercase tracking-tight flex items-center gap-2 border-b border-gray-100 dark:border-slate-700/60 pb-3'>
              <Bookmark className='h-5 w-5 text-blue-500' />
              Curated Collections ({lists.length})
            </h2>
            {loadingLists ? (
              <div className='flex justify-center py-8'>
                <Loader2 className='animate-spin text-blue-600 dark:text-blue-400 h-6 w-6' />
              </div>
            ) : lists.length === 0 ? (
              <p className='text-center py-8 text-sm text-gray-500 dark:text-gray-400 italic'>
                No public collections displayed yet.
              </p>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {lists.map(lst => (
                  <Link
                    key={lst.id}
                    to={`/users/${username}/lists/${lst.id}/${lst.slug}`}
                    className='block p-4 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all bg-gray-50/40 dark:bg-slate-700/30 group'
                  >
                    <div className='flex justify-between items-start gap-2 mb-2'>
                      <h3 className='font-bold text-gray-900 dark:text-slate-100 text-base group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors leading-snug'>
                        {lst.title}
                      </h3>
                      {lst.system_type && (
                        <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-sky-300 uppercase tracking-tighter'>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    {lst.description && (
                      <p className='text-sm text-gray-500 dark:text-slate-400 line-clamp-2 mb-3'>
                        {lst.description}
                      </p>
                    )}
                    <div className='flex items-center gap-4 text-xs text-gray-400 dark:text-slate-400 font-medium mt-auto'>
                      <span className='flex items-center gap-1 text-blue-600 dark:text-sky-400 font-semibold'>
                        <FolderHeart className='h-3.5 w-3.5' />
                        {lst.items?.length || 0} sites
                      </span>
                      <span className='flex items-center gap-1'>
                        <Eye className='h-3.5 w-3.5' />
                        {lst.view_count || 0} views
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default UserProfile;
