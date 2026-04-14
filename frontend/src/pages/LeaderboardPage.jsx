import {
  Trophy,
  Notebook,
  MapPin,
  Warehouse,
  Edit,
  Star,
  MessageCircle,
  ChevronRight,
  Medal,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';
import LeaderboardTable from '../components/tables/LeaderboardTable';
import {
  getOverallLeaderboard,
  getCategoryLeaderboard,
  getCenterLeaderboard,
} from '../services/leaderboard';

const CategoryCard = ({ title, icon: Icon, metric, label, limit = 5 }) => {
  const { data, isLoading } = useQuery(['leaderboard', metric], () =>
    getCategoryLeaderboard(metric, { limit })
  );

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow'>
      <div className='p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50'>
        <div className='flex items-center space-x-2'>
          <div className='p-1.5 bg-white rounded-lg shadow-sm'>
            <Icon className='w-4 h-4 text-blue-600' />
          </div>
          <h3 className='font-bold text-gray-900'>{title}</h3>
        </div>
      </div>
      <div className='p-2'>
        <LeaderboardTable data={data?.entries} isLoading={isLoading} metricLabel={label} />
      </div>
    </div>
  );
};

const LeaderboardPage = () => {
  const { data: overallData, isLoading: isOverallLoading } = useQuery(
    ['leaderboard', 'overall'],
    () => getOverallLeaderboard({ limit: 10 })
  );

  const { data: centersData, isLoading: isCentersLoading } = useQuery(
    ['leaderboard', 'centers'],
    () => getCenterLeaderboard({ limit: 5 })
  );

  const topThree = overallData?.entries?.slice(0, 3) || [];

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      <SEO
        title='Leaderboard | Divemap'
        description='See the top contributors and active divers in the Divemap community.'
      />

      <PageHeader
        title='Community Leaderboard'
        subtitle='Celebrating our most active divers and contributors'
      />

      {/* Hero Section: Top 3 Overall */}
      <section className='mb-12'>
        <div className='flex flex-col items-center justify-center space-y-8 md:space-y-0 md:flex-row md:space-x-8 py-8 bg-gradient-to-b from-blue-50 to-transparent rounded-3xl'>
          {/* Rank 2 */}
          {topThree[1] && (
            <div className='flex flex-col items-center space-y-3 order-2 md:order-1 mt-8'>
              <div className='relative'>
                <Avatar
                  src={topThree[1].avatar_url}
                  alt={topThree[1].username}
                  size='xl'
                  className='border-4 border-gray-300'
                />
                <div className='absolute -bottom-2 -right-2 bg-gray-300 text-gray-700 rounded-full p-1.5 shadow-sm'>
                  <Medal className='w-5 h-5' />
                </div>
              </div>
              <div className='text-center'>
                <Link
                  to={`/users/${topThree[1].username}`}
                  className='font-bold text-gray-900 hover:text-blue-600 transition-colors'
                >
                  {topThree[1].username}
                </Link>
                <p className='text-sm font-medium text-blue-600'>
                  {topThree[1].points.toLocaleString()} pts
                </p>
              </div>
            </div>
          )}

          {/* Rank 1 */}
          {topThree[0] && (
            <div className='flex flex-col items-center space-y-4 order-1 md:order-2 scale-110'>
              <div className='relative'>
                <div className='absolute -top-6 left-1/2 -translate-x-1/2'>
                  <Trophy className='w-10 h-10 text-yellow-500 animate-bounce' />
                </div>
                <Avatar
                  src={topThree[0].avatar_url}
                  alt={topThree[0].username}
                  size='2xl'
                  className='border-4 border-yellow-400 shadow-xl'
                />
                <div className='absolute -bottom-2 -right-2 bg-yellow-400 text-white rounded-full p-2 shadow-md'>
                  <span className='font-bold'>#1</span>
                </div>
              </div>
              <div className='text-center'>
                <Link
                  to={`/users/${topThree[0].username}`}
                  className='text-xl font-black text-gray-900 hover:text-blue-600 transition-colors block'
                >
                  {topThree[0].username}
                </Link>
                <p className='text-lg font-bold text-blue-600'>
                  {topThree[0].points.toLocaleString()} pts
                </p>
              </div>
            </div>
          )}

          {/* Rank 3 */}
          {topThree[2] && (
            <div className='flex flex-col items-center space-y-3 order-3 mt-8'>
              <div className='relative'>
                <Avatar
                  src={topThree[2].avatar_url}
                  alt={topThree[2].username}
                  size='xl'
                  className='border-4 border-amber-600/50'
                />
                <div className='absolute -bottom-2 -right-2 bg-amber-600 text-white rounded-full p-1.5 shadow-sm'>
                  <Medal className='w-5 h-5' />
                </div>
              </div>
              <div className='text-center'>
                <Link
                  to={`/users/${topThree[2].username}`}
                  className='font-bold text-gray-900 hover:text-blue-600 transition-colors'
                >
                  {topThree[2].username}
                </Link>
                <p className='text-sm font-medium text-blue-600'>
                  {topThree[2].points.toLocaleString()} pts
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Grid Layout for Categories */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {/* Overall Points - Full List */}
        <div className='md:col-span-2 lg:col-span-1 bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden'>
          <div className='p-4 bg-blue-600 text-white flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <Trophy className='w-5 h-5' />
              <h3 className='font-bold'>Top Divers (Overall)</h3>
            </div>
          </div>
          <div className='p-2'>
            <LeaderboardTable
              data={overallData?.entries}
              isLoading={isOverallLoading}
              metricLabel='Total Points'
            />
          </div>
        </div>

        <CategoryCard title='Most Dives Logged' icon={Notebook} metric='dives' label='Dives' />

        <CategoryCard title='Top Site Creators' icon={MapPin} metric='sites' label='Sites' />

        <div className='bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden'>
          <div className='p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50'>
            <div className='flex items-center space-x-2'>
              <div className='p-1.5 bg-white rounded-lg shadow-sm'>
                <Warehouse className='w-4 h-4 text-blue-600' />
              </div>
              <h3 className='font-bold text-gray-900'>Top Diving Centers</h3>
            </div>
          </div>
          <div className='p-2'>
            <LeaderboardTable
              data={centersData?.entries}
              isLoading={isCentersLoading}
              type='center'
              metricLabel='Trips'
            />
          </div>
        </div>

        <CategoryCard title='Top Reviewers' icon={Star} metric='reviews' label='Reviews' />

        <CategoryCard
          title='Top Commenters'
          icon={MessageCircle}
          metric='comments'
          label='Comments'
        />
      </div>

      {/* Point System Info */}
      <section className='mt-16 bg-gray-50 rounded-2xl p-6 border border-gray-200'>
        <h3 className='text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2'>
          <span>How are points calculated?</span>
        </h3>
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4'>
          {[
            { label: 'Create Site', pts: 20 },
            { label: 'Log Dive', pts: 10 },
            { label: 'Create Center', pts: 15 },
            { label: 'Edit Site', pts: 5 },
            { label: 'Review', pts: 5 },
            { label: 'Comment', pts: 2 },
          ].map(item => (
            <div
              key={item.label}
              className='bg-white p-3 rounded-xl border border-gray-100 text-center'
            >
              <p className='text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1'>
                {item.label}
              </p>
              <p className='text-xl font-black text-blue-600'>
                {item.pts}
                <span className='text-xs ml-0.5'>pts</span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LeaderboardPage;
