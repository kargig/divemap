import { Notebook, Trophy, MapPin, Globe, Star, Building2, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

/**
 * DiverCommunityGrid
 * Renders an un-cramped, spacious, and easily readable breakdown of community contributions
 * with generous horizontal room and no truncated text.
 */
const DiverCommunityGrid = ({ profile, className = '' }) => {
  if (!profile) return null;

  const stats = profile.stats || {};
  const centers = profile.centers_owned || [];
  const totalDives =
    stats.total_dives !== undefined
      ? stats.total_dives
      : (profile.number_of_dives || 0) +
        (stats.dives_created || 0) +
        (stats.buddy_dives_count || 0);
  const sitesVisited = stats.unique_dive_sites_logged ?? stats.dive_sites_visited ?? 0;
  const countriesVisited = stats.countries_visited_count ?? stats.countries_visited ?? 0;
  const siteRatings = stats.site_ratings_count ?? stats.dive_sites_rated ?? 0;
  const centersCount = stats.diving_centers_owned ?? centers.length;

  const statItems = [
    {
      label: 'Total Dives',
      value: totalDives.toLocaleString(),
      subLabel:
        stats.dives_created > 0 ? `${stats.dives_created} logged on Divemap` : 'Career dives',
      icon: <Notebook className='w-4 h-4 text-blue-600 dark:text-sky-400' />,
      iconBg: 'bg-blue-100 dark:bg-blue-950/60',
      link:
        stats.dives_created > 0 ? `/dives?username=${encodeURIComponent(profile.username)}` : null,
    },
    {
      label: 'Community Points',
      value: (stats.total_points || 0).toLocaleString(),
      subLabel: stats.leaderboard_rank ? `Leaderboard Rank #${stats.leaderboard_rank}` : 'Points',
      icon: <Trophy className='w-4 h-4 text-amber-600 dark:text-amber-400' />,
      iconBg: 'bg-amber-100 dark:bg-amber-950/60',
      link: '/leaderboard',
    },
    {
      label: 'Sites Visited',
      value: sitesVisited.toLocaleString(),
      subLabel: countriesVisited > 0 ? `Across ${countriesVisited} countries` : 'Explored sites',
      icon: <MapPin className='w-4 h-4 text-emerald-600 dark:text-emerald-400' />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    },
    {
      label: 'Sites Contributed',
      value: (stats.dive_sites_created || 0).toLocaleString(),
      subLabel: 'Mapped on Divemap',
      icon: <Globe className='w-4 h-4 text-indigo-600 dark:text-indigo-400' />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/60',
      link:
        stats.dive_sites_created > 0
          ? `/dive-sites?created_by_username=${encodeURIComponent(profile.username)}`
          : null,
    },
    {
      label: 'Site Ratings',
      value: siteRatings.toLocaleString(),
      subLabel: stats.site_comments_count > 0 ? `${stats.site_comments_count} reviews` : 'Reviews',
      icon: <Star className='w-4 h-4 text-orange-600 dark:text-orange-400' />,
      iconBg: 'bg-orange-100 dark:bg-orange-950/60',
    },
    {
      label: 'Center Owner',
      value: centersCount.toString(),
      subLabel: centers.length > 0 ? centers[0].name : 'None',
      icon: <Building2 className='w-4 h-4 text-purple-600 dark:text-purple-400' />,
      iconBg: 'bg-purple-100 dark:bg-purple-950/60',
      link: centers.length > 0 ? `/diving-centers/${centers[0].id}/${centers[0].slug || ''}` : null,
    },
  ];

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 sm:p-5 border border-gray-100 dark:border-slate-700 ${className}`}
    >
      <div className='flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-slate-700/60'>
        <h3 className='text-sm sm:text-base font-bold uppercase tracking-tight text-gray-900 dark:text-slate-100 flex items-center gap-2'>
          <Trophy className='w-4 h-4 text-yellow-500' />
          Community Impact
        </h3>
        {stats.leaderboard_rank && (
          <span className='px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full'>
            Rank #{stats.leaderboard_rank}
          </span>
        )}
      </div>

      {/* Spacious, Non-Cramped Stat Rows */}
      <div className='space-y-2.5'>
        {statItems.map(item => {
          const content = (
            <div
              className={`flex items-center justify-between p-2.5 rounded-lg bg-gray-50/80 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600/40 transition-all ${
                item.link
                  ? 'hover:bg-blue-50/60 dark:hover:bg-slate-700 hover:border-blue-200 dark:hover:border-slate-500 cursor-pointer'
                  : ''
              }`}
            >
              <div className='flex items-center gap-2.5 min-w-0'>
                <div className={`p-2 rounded-lg ${item.iconBg} shrink-0`}>{item.icon}</div>
                <div className='min-w-0'>
                  <div className='text-xs font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wide'>
                    {item.label}
                  </div>
                  {item.subLabel && (
                    <div className='text-[11px] text-gray-500 dark:text-slate-400 truncate'>
                      {item.subLabel}
                    </div>
                  )}
                </div>
              </div>
              <div className='text-right shrink-0 pl-2'>
                <div className='text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100'>
                  {item.value}
                </div>
              </div>
            </div>
          );

          if (item.link) {
            return (
              <Link key={item.label} to={item.link} className='block text-inherit no-underline'>
                {content}
              </Link>
            );
          }

          return <div key={item.label}>{content}</div>;
        })}
      </div>

      {/* Community Verification Footnote */}
      <div className='mt-3.5 pt-3 border-t border-gray-100 dark:border-slate-700/60 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400'>
        <CheckCircle2 className='w-4 h-4 text-emerald-500 shrink-0' />
        <span>Verified Divemap Community Member</span>
      </div>
    </div>
  );
};

export default DiverCommunityGrid;
