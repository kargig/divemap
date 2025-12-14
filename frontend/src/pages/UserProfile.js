import {
  Star,
  MapPin,
  MessageSquare,
  Calendar,
  Map,
  Activity,
  Building2,
  Users,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import { getUserPublicProfile } from '../api';
import Avatar from '../components/Avatar';
import usePageTitle from '../hooks/usePageTitle';

const UserProfile = () => {
  // Set page title
  usePageTitle('Divemap - User Profile');
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getUserPublicProfile(username);
        setProfile(data);
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
    };

    const content = (
      <div
        className={`text-center p-4 ${colorClasses[color]} rounded-lg ${link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
      >
        <div className='flex items-center justify-center mb-2'>{icon}</div>
        <div className='text-2xl font-bold'>{value}</div>
        <div className='text-sm text-gray-600 mt-1'>{label}</div>
      </div>
    );

    if (link) {
      return <Link to={link}>{content}</Link>;
    }

    return content;
  };

  return (
    <div className='max-w-4xl mx-auto px-4 py-8'>
      {/* Header */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex items-center space-x-6'>
          <Avatar
            src={profile.avatar_url}
            alt={profile.username}
            size='2xl'
            fallbackText={profile.username}
          />
          <div className='flex-1'>
            <h1 className='text-3xl font-bold text-gray-900 mb-2'>{profile.username}</h1>
            <div className='flex items-center space-x-4 text-gray-600'>
              <div className='flex items-center space-x-1'>
                <MapPin className='h-4 w-4' />
                <span>{profile.number_of_dives} dives</span>
              </div>
              <div className='flex items-center space-x-1'>
                <Calendar className='h-4 w-4' />
                <span>Member since {formatDate(profile.member_since)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Certifications */}
          {profile.certifications && profile.certifications.length > 0 && (
            <div className='bg-white rounded-lg shadow-md p-6'>
              <h2 className='text-xl font-semibold text-gray-900 mb-4'>Certifications</h2>
              <div className='space-y-3'>
                {profile.certifications.map((cert, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                  >
                    <div>
                      <div className='font-medium text-gray-900'>{cert.certification_level}</div>
                      <div className='text-sm text-gray-600'>
                        {cert.diving_organization.name} ({cert.diving_organization.acronym})
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
                icon={<Map className='h-6 w-6 text-blue-600' />}
                value={profile.stats.dive_sites_created}
                label='Dive Sites Created'
                link={`/dive-sites?created_by_username=${profile.username}`}
                color='blue'
              />
              <StatCard
                icon={<Activity className='h-6 w-6 text-green-600' />}
                value={profile.stats.dives_created}
                label='Dives Created'
                link={`/dives?username=${profile.username}`}
                color='green'
              />
              <StatCard
                icon={<Building2 className='h-6 w-6 text-purple-600' />}
                value={profile.stats.diving_centers_owned}
                label='Diving Centers Owned'
                color='purple'
              />
              <StatCard
                icon={<MessageSquare className='h-6 w-6 text-orange-600' />}
                value={profile.stats.site_comments_count}
                label='Dive Site Comments'
                color='orange'
              />
              <StatCard
                icon={<Star className='h-6 w-6 text-yellow-600' />}
                value={profile.stats.site_ratings_count}
                label='Dive Site Ratings'
                color='yellow'
              />
              <StatCard
                icon={<Activity className='h-6 w-6 text-indigo-600' />}
                value={profile.stats.total_dives_claimed}
                label='Total Dives Claimed'
                color='indigo'
              />
              <StatCard
                icon={<Users className='h-6 w-6 text-teal-600' />}
                value={profile.stats.buddy_dives_count}
                label='Dives as Buddy'
                link={`/dives?buddy_username=${profile.username}`}
                color='teal'
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
                <span className='text-gray-600'>Total Dives Claimed:</span>
                <span className='font-semibold'>{profile.stats.total_dives_claimed}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Member Since:</span>
                <span className='font-semibold'>{formatDate(profile.member_since)}</span>
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
                <span className='text-gray-600'>Diving Centers Owned:</span>
                <span className='font-semibold'>{profile.stats.diving_centers_owned}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Site Comments:</span>
                <span className='font-semibold'>{profile.stats.site_comments_count}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Site Ratings:</span>
                <span className='font-semibold'>{profile.stats.site_ratings_count}</span>
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
