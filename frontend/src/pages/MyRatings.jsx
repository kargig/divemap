import { Typography, Card, Button, Empty } from 'antd';
import { format } from 'date-fns';
import { Star, ChevronLeft, MapPin, Calendar } from 'lucide-react';
import React, { useMemo } from 'react';
import { useInfiniteQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getMyRatings } from '../api';
import SEO from '../components/SEO';
import InfiniteScrollTrigger from '../components/ui/InfiniteScrollTrigger';
import StarfishRating from '../components/ui/StarfishRating';

const { Title, Paragraph } = Typography;

const MyRatings = () => {
  const pageSize = 20;

  const {
    data: infiniteRatingsData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
  } = useInfiniteQuery(
    ['my-ratings'],
    ({ pageParam = 1 }) => {
      return getMyRatings({ page: pageParam, page_size: pageSize });
    },
    {
      getNextPageParam: lastPage => {
        if (lastPage.ratings && lastPage.ratings.length === pageSize) {
          const totalPages = lastPage.totalPages || 1;
          const currentPage = lastPage.page || 1;
          return currentPage < totalPages ? currentPage + 1 : undefined;
        }
        return undefined;
      },
      staleTime: 5 * 60 * 1000,
    }
  );

  const ratings = useMemo(() => {
    if (!infiniteRatingsData) return [];
    return infiniteRatingsData.pages.flatMap(page => page.ratings || page.items || []);
  }, [infiniteRatingsData]);

  const totalCount = infiniteRatingsData?.pages[0]?.totalCount || 0;

  const formatDateSafely = dateStr => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return new Date(dateStr).toLocaleDateString();
    }
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 pb-12 transition-colors duration-200'>
      <SEO
        title='My Ratings History'
        description='View your full dive site rating history on Divemap.'
      />
      <div className='max-w-4xl mx-auto py-4 sm:py-8'>
        {/* Navigation / Header */}
        <div className='mb-8'>
          <Link
            to='/profile'
            className='inline-flex items-center text-divemap-blue hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4 transition-colors'
          >
            <ChevronLeft className='h-4 w-4 mr-1' />
            Back to Profile
          </Link>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
            <div>
              <Title level={2} className='!mb-1 dark:!text-white flex items-center'>
                <Star className='mr-3 text-divemap-blue dark:text-blue-400' />
                My Ratings History
              </Title>
              <Paragraph className='text-gray-500 dark:text-gray-400 !mb-0'>
                A complete history of all ratings you've submitted for dive sites.
              </Paragraph>
            </div>
            {totalCount > 0 && (
              <span className='inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 self-start sm:self-center'>
                {totalCount} {totalCount === 1 ? 'Rating' : 'Ratings'}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className='flex justify-center items-center py-12'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500' />
          </div>
        ) : error ? (
          <div className='bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-center font-medium border border-red-100 dark:border-red-900/30'>
            Failed to load your ratings. Please try refreshing.
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            {ratings.length === 0 ? (
              <Card className='text-center py-12 text-gray-500 shadow-sm rounded-lg'>
                No ratings submitted yet.
              </Card>
            ) : (
              <div className='space-y-4'>
                {ratings.map(rating => (
                  <div
                    key={rating.id}
                    className='p-4 sm:p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-blue-100/50 dark:hover:bg-blue-900/40 transition-all duration-200 group flex flex-col sm:flex-row sm:items-center justify-between gap-4'
                  >
                    <div className='flex-1'>
                      <Link
                        to={`/dive-sites/${rating.dive_site?.id}`}
                        className='text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 hover:text-divemap-blue dark:hover:text-blue-400 transition-colors block mb-1.5'
                      >
                        {rating.dive_site?.name || 'Unknown Dive Site'}
                      </Link>
                      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500'>
                        {(rating.dive_site?.region || rating.dive_site?.country) && (
                          <span className='flex items-center gap-1'>
                            <MapPin className='h-3.5 w-3.5' />
                            {rating.dive_site.region}
                            {rating.dive_site.region && rating.dive_site.country && ', '}
                            {rating.dive_site.country}
                          </span>
                        )}
                        <span className='flex items-center gap-1'>
                          <Calendar className='h-3.5 w-3.5' />
                          Rated on {formatDateSafely(rating.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className='flex items-center gap-3 bg-blue-50/50 dark:bg-blue-950/40 px-3.5 py-1.5 rounded-xl border border-blue-100/30 dark:border-blue-900/20 self-start sm:self-center'>
                      <StarfishRating value={rating.score} readOnly size={18} />
                      <span className='text-sm font-bold text-gray-700 dark:text-gray-300 min-w-[3rem] text-right'>
                        {rating.score} / 10
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <InfiniteScrollTrigger
              onIntersect={fetchNextPage}
              hasNextPage={!!hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRatings;
