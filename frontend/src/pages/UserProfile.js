import {
  Star,
  MapPin,
  MessageSquare,
  Calendar,
  Map,
  Activity,
  Building2,
  Users,
  Gauge,
  Wind,
  Cylinder,
  Timer,
  Shield,
  UserPlus,
  UserCheck,
  Clock,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link, useNavigate } from 'react-router-dom';

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

  const totalDives =
    (profile.number_of_dives || 0) +
    (profile.stats?.dives_created || 0) +
    (profile.stats?.buddy_dives_count || 0);

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const StatCard = ({ icon, value, label, link, color }) => {
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
        className={`text-center p-4 ${colorClasses[color] || colorClasses.blue} rounded-lg ${link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
      >
        <div className='flex items-center justify-center mb-2'>{icon}</div>
        <div className='text-xl font-bold break-words'>{value}</div>
        <div className='text-sm text-gray-600 mt-1'>{label}</div>
      </div>
    );

    if (link) {
      return <Link to={link}>{content}</Link>;
    }

    return content;
  };

  const CertificationStats = ({ stats }) => {
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
    if (stats.max_stages > 0) {
      bestTanksValue += ` + ${stats.max_stages} Stg`;
    }

    return (
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Certification Level Overview</h2>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          {stats.max_depth_str && (
            <StatCard
              icon={<Gauge className='h-6 w-6 text-cyan-600' />}
              value={stats.max_depth_str}
              label='Max Depth'
              color='cyan'
            />
          )}

          <StatCard
            icon={<Wind className='h-6 w-6 text-rose-600' />}
            value={bestGasValue}
            label='Best Gas'
            color='rose'
          />

          <StatCard
            icon={<Cylinder className='h-6 w-6 text-amber-600' />}
            value={bestTanksValue}
            label='Best Tanks'
            color='amber'
          />

          {stats.max_deco_time && (
            <StatCard
              icon={<Timer className='h-6 w-6 text-emerald-600' />}
              value={stats.max_deco_time}
              label='Max Deco Time'
              color='emerald'
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      {/* Header */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex items-center space-x-6 w-full'>
          <div className='shrink-0'>
            <Avatar
              src={profile.avatar_url}
              alt={profile.username}
              size='2xl'
              fallbackText={profile.username}
            />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='flex justify-between items-start w-full gap-4'>
              <h1 className='text-3xl font-bold text-gray-900 mb-2 truncate'>{profile.username}</h1>
              {currentUser && currentUser.username !== username && (
                <button
                  onClick={handleBuddyAction}
                  disabled={isProcessingFriendship || friendshipStatus === 'PENDING'}
                  className={`shrink-0 flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    friendshipStatus === 'ACCEPTED'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                      : friendshipStatus === 'PENDING'
                        ? 'bg-gray-100 text-gray-500 cursor-default'
                        : 'bg-green-600 hover:bg-green-700 text-white shadow-md'
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
              )}
            </div>
            <div className='flex items-center space-x-4 text-gray-600'>
              <div className='flex items-center space-x-1'>
                <MapPin className='h-4 w-4' />
                <span>{totalDives} dives</span>
              </div>
              <div className='flex items-center space-x-1'>
                <Calendar className='h-4 w-4' />
                <span>Member since {formatDate(profile.member_since)}</span>
              </div>
              <div className='flex items-center space-x-1'>
                <Shield className='h-4 w-4' />
                <span>
                  {profile.is_admin ? 'Administrator' : profile.is_moderator ? 'Moderator' : 'User'}
                </span>
              </div>
            </div>
            {/* Social Media Links */}
            {profile.social_links && profile.social_links.length > 0 && (
              <div className='mt-4 flex flex-wrap gap-3'>
                {profile.social_links.map(link => (
                  <a
                    key={link.platform}
                    href={link.url}
                    target='_blank'
                    rel='noopener noreferrer nofollow'
                    className='text-gray-500 hover:text-blue-600 transition-colors bg-gray-100 hover:bg-gray-200 p-2 rounded-full'
                    title={link.platform}
                  >
                    {getSocialMediaIcon(link.platform, { color: '000000', className: 'w-5 h-5' })}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Certification Stats */}
          {profile.certification_stats && (
            <CertificationStats stats={profile.certification_stats} />
          )}

          {/* Certifications */}
          {profile.certifications && profile.certifications.length > 0 && (
            <div className='bg-white rounded-lg shadow-md p-6'>
              <h2 className='text-xl font-semibold text-gray-900 mb-4'>Certifications</h2>
              <div className='space-y-3'>
                {profile.certifications.map((cert, index) => (
                  <div
                    key={index}
                    className='flex items-start justify-between p-3 bg-gray-50 rounded-lg'
                  >
                    <div className='flex items-start gap-3'>
                      <OrganizationLogo org={cert.diving_organization} />
                      <div>
                        <div className='font-medium text-gray-900'>{cert.certification_level}</div>
                        <div className='text-sm text-gray-600'>
                          {cert.diving_organization.name} ({cert.diving_organization.acronym})
                        </div>
                        {cert.certification_level_link && (
                          <div className='mt-2 flex flex-wrap gap-2 text-xs'>
                            {cert.certification_level_link.max_depth && (
                              <span className='bg-blue-100 text-blue-800 px-2 py-0.5 rounded'>
                                Depth: {cert.certification_level_link.max_depth}
                              </span>
                            )}
                            {cert.certification_level_link.gases && (
                              <span className='bg-purple-100 text-purple-800 px-2 py-0.5 rounded'>
                                Gases: {cert.certification_level_link.gases}
                              </span>
                            )}
                            {cert.certification_level_link.tanks && (
                              <span className='bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-300'>
                                Tanks: {cert.certification_level_link.tanks}
                              </span>
                            )}
                            {cert.certification_level_link.deco_time_limit && (
                              <span className='bg-red-100 text-red-800 px-2 py-0.5 rounded'>
                                Deco: {cert.certification_level_link.deco_time_limit}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {cert.is_active && (
                      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Stats */}
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>Activity</h2>
            <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
              <StatCard
                icon={<Activity className='h-6 w-6 text-indigo-600' />}
                value={totalDives}
                label='Total Dives'
                color='indigo'
              />
              <StatCard
                icon={<Activity className='h-6 w-6 text-green-600' />}
                value={profile.stats.dives_created}
                label='Dives Created'
                link={`/dives?username=${profile.username}`}
                color='green'
              />
              <StatCard
                icon={<Users className='h-6 w-6 text-teal-600' />}
                value={profile.stats.buddy_dives_count}
                label='Dives as Buddy'
                link={`/dives?buddy_username=${profile.username}`}
                color='teal'
              />
              <StatCard
                icon={<Map className='h-6 w-6 text-blue-600' />}
                value={profile.stats.dive_sites_created}
                label='Dive Sites Created'
                link={`/dive-sites?created_by_username=${profile.username}`}
                color='blue'
              />
              <StatCard
                icon={<Star className='h-6 w-6 text-yellow-600' />}
                value={profile.stats.site_ratings_count}
                label='Dive Site Ratings'
                color='yellow'
              />
              <StatCard
                icon={<MessageSquare className='h-6 w-6 text-orange-600' />}
                value={profile.stats.site_comments_count}
                label='Dive Site Comments'
                color='orange'
              />
              <StatCard
                icon={<Building2 className='h-6 w-6 text-purple-600' />}
                value={profile.stats.diving_centers_owned}
                label='Diving Centers Owned'
                color='purple'
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Quick Stats */}
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Quick Stats</h3>
            <div className='space-y-3'>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Total Dives:</span>
                <span className='font-semibold'>{totalDives}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dives Created:</span>
                <span className='font-semibold'>
                  {profile.stats.dives_created > 0 ? (
                    <Link
                      to={`/dives?username=${profile.username}`}
                      className='text-blue-600 hover:underline'
                    >
                      {profile.stats.dives_created}
                    </Link>
                  ) : (
                    profile.stats.dives_created
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dives as Buddy:</span>
                <span className='font-semibold'>
                  {profile.stats.buddy_dives_count > 0 ? (
                    <Link
                      to={`/dives?buddy_username=${profile.username}`}
                      className='text-blue-600 hover:underline'
                    >
                      {profile.stats.buddy_dives_count}
                    </Link>
                  ) : (
                    profile.stats.buddy_dives_count
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Sites Created:</span>
                <span className='font-semibold'>
                  {profile.stats.dive_sites_created > 0 ? (
                    <Link
                      to={`/dive-sites?created_by_username=${profile.username}`}
                      className='text-blue-600 hover:underline'
                    >
                      {profile.stats.dive_sites_created}
                    </Link>
                  ) : (
                    profile.stats.dive_sites_created
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Site Ratings:</span>
                <span className='font-semibold'>{profile.stats.site_ratings_count}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Site Comments:</span>
                <span className='font-semibold'>{profile.stats.site_comments_count}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Diving Centers Owned:</span>
                <span className='font-semibold'>{profile.stats.diving_centers_owned}</span>
              </div>
              <div className='flex justify-between border-t pt-2 mt-2'>
                <span className='text-gray-600'>Member Since:</span>
                <span className='font-semibold'>{formatDate(profile.member_since)}</span>
              </div>
            </div>
          </div>

          {/* No certifications message */}
          {(!profile.certifications || profile.certifications.length === 0) && (
            <div className='bg-white rounded-lg shadow-md p-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Certifications</h3>
              <p className='text-gray-600 text-sm'>No certifications listed yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
