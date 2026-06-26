import { Typography, Card, Button, Empty } from 'antd';
import { format } from 'date-fns';
import { MessageSquare, ChevronLeft, MapPin, Calendar } from 'lucide-react';
import React, { useMemo } from 'react';
import { useInfiniteQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getMyComments } from '../api';
import SEO from '../components/SEO';
import InfiniteScrollTrigger from '../components/ui/InfiniteScrollTrigger';

const { Title, Paragraph } = Typography;

const MyComments = () => {
  const pageSize = 15;

  const {
    data: infiniteCommentsData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
  } = useInfiniteQuery(
    ['my-comments'],
    ({ pageParam = 1 }) => {
      return getMyComments({ page: pageParam, page_size: pageSize });
    },
    {
      getNextPageParam: lastPage => {
        if (lastPage.comments && lastPage.comments.length === pageSize) {
          const totalPages = lastPage.totalPages || 1;
          const currentPage = lastPage.page || 1;
          return currentPage < totalPages ? currentPage + 1 : undefined;
        }
        return undefined;
      },
      staleTime: 5 * 60 * 1000,
    }
  );

  const comments = useMemo(() => {
    if (!infiniteCommentsData) return [];
    return infiniteCommentsData.pages.flatMap(page => page.comments || page.items || []);
  }, [infiniteCommentsData]);

  const totalCount = infiniteCommentsData?.pages[0]?.totalCount || 0;

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
        title='My Comments History'
        description='View your full dive site comment history on Divemap.'
      />
      <div className='max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
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
                <MessageSquare className='mr-3 text-divemap-blue dark:text-blue-400' />
                My Comments History
              </Title>
              <Paragraph className='text-gray-500 dark:text-gray-400 !mb-0'>
                A complete history of all comments you've posted on dive sites.
              </Paragraph>
            </div>
            {totalCount > 0 && (
              <span className='inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 self-start sm:self-center'>
                {totalCount} {totalCount === 1 ? 'Comment' : 'Comments'}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className='flex justify-center items-center py-20'>
            <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-divemap-blue' />
          </div>
        ) : error ? (
          <div className='text-red-500 dark:text-red-400 text-center py-10 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/40'>
            Failed to load comments. Please try again later.
          </div>
        ) : comments.length === 0 ? (
          <Card className='shadow-sm rounded-xl py-12 text-center dark:bg-gray-800 dark:border-gray-700'>
            <Empty
              description={
                <span className='text-gray-500 dark:text-gray-400'>
                  You have not posted any comments yet.
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
            <Link to='/dive-sites'>
              <Button
                type='primary'
                className='bg-divemap-blue hover:bg-blue-600 border-0 mt-4'
                size='large'
              >
                Discover Dive Sites
              </Button>
            </Link>
          </Card>
        ) : (
          <div className='space-y-4 flex flex-col'>
            {comments.map(comment => (
              <div
                key={comment.id}
                className='bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-blue-100/50 dark:hover:bg-blue-900/40 transition-all duration-200 group'
              >
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3'>
                  <Link
                    to={`/dive-sites/${comment.dive_site?.id}`}
                    className='text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 hover:text-divemap-blue dark:hover:text-blue-400 transition-colors'
                  >
                    {comment.dive_site?.name || 'Unknown Dive Site'}
                  </Link>
                  <div className='flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500'>
                    {(comment.dive_site?.region || comment.dive_site?.country) && (
                      <span className='flex items-center gap-1'>
                        <MapPin className='h-3.5 w-3.5' />
                        {comment.dive_site.region}
                        {comment.dive_site.region && comment.dive_site.country && ', '}
                        {comment.dive_site.country}
                      </span>
                    )}
                    <span className='flex items-center gap-1'>
                      <Calendar className='h-3.5 w-3.5' />
                      {formatDateSafely(comment.created_at)}
                    </span>
                  </div>
                </div>
                <p className='text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words !mb-0'>
                  {comment.comment_text}
                </p>
              </div>
            ))}

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

export default MyComments;
