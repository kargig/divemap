import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { Trophy, Medal } from 'lucide-react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import Avatar from '../Avatar';

/**
 * LeaderboardTable - Displays a simplified leaderboard for users or centers
 */
const LeaderboardTable = ({
  data = [],
  type = 'user', // 'user' or 'center'
  metricLabel = 'Points',
  isLoading = false,
}) => {
  // Define columns based on type
  const columns = [
    {
      header: 'Rank',
      accessorKey: 'rank',
      cell: info => {
        const rank = info.getValue();
        if (rank === 1) return <Trophy className='w-5 h-5 text-yellow-500' />;
        if (rank === 2) return <Medal className='w-5 h-5 text-gray-400' />;
        if (rank === 3) return <Medal className='w-5 h-5 text-amber-600' />;
        return <span className='font-medium text-gray-500'>{rank}</span>;
      },
    },
    {
      header: type === 'user' ? 'User' : 'Diving Center',
      accessorKey: type === 'user' ? 'username' : 'name',
      cell: info => {
        const row = info.row.original;
        const name = info.getValue();
        const imgUrl = type === 'user' ? row.avatar_full_url || row.avatar_url : row.logo_url;
        const linkTo = type === 'user' ? `/users/${name}` : `/diving-centers/${row.center_id}`;

        return (
          <div className='flex items-center space-x-2 min-w-0'>
            <Avatar src={imgUrl} alt={name} size='sm' fallbackText={name} className='shrink-0' />
            <Link
              to={linkTo}
              className='font-semibold text-blue-600 inline-block truncate max-w-[100px] sm:max-w-[180px] md:max-w-[110px] lg:max-w-[120px] xl:max-w-[180px] hover:text-blue-800 transition-colors'
              title={name}
            >
              {name}
            </Link>
          </div>
        );
      },
    },
    {
      header: metricLabel,
      accessorKey: 'count',
      cell: info => (
        <span className='font-bold' style={{ color: '#0072B2' }}>
          {info.getValue().toLocaleString()}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className='flex justify-center items-center py-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className='text-center py-8 text-gray-500 text-sm italic'>No entries yet</div>;
  }

  return (
    <div className='overflow-hidden w-full'>
      <table className='min-w-full divide-y divide-gray-200'>
        <thead className='bg-gray-50'>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => {
                let alignClass = 'text-left';
                if (index === 0 || index === 2) alignClass = 'text-center';
                let widthClass = '';
                if (index === 0) widthClass = 'w-10 sm:w-16';
                if (index === 2) widthClass = 'w-24 sm:w-32';
                return (
                  <th
                    key={header.id}
                    className={`px-1.5 sm:px-3 py-2.5 ${alignClass} ${widthClass} text-xs font-medium text-gray-500 uppercase tracking-wider`}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className='hover:bg-blue-50 transition-colors'>
              {row.getVisibleCells().map((cell, index) => {
                let alignClass = 'text-left';
                if (index === 0 || index === 2) alignClass = 'text-center';
                return (
                  <td
                    key={cell.id}
                    className={`px-1.5 py-2.5 whitespace-nowrap text-sm text-gray-900 ${alignClass}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

LeaderboardTable.propTypes = {
  data: PropTypes.array,
  type: PropTypes.oneOf(['user', 'center']),
  metricLabel: PropTypes.string,
  isLoading: PropTypes.bool,
};

export default LeaderboardTable;
