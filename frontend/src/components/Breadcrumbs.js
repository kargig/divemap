import { ChevronRight, Home } from 'lucide-react';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Breadcrumbs Component
 *
 * Provides hierarchical navigation links for better context.
 */
const Breadcrumbs = ({ items = [] }) => {
  return (
    <nav className='flex mb-6 overflow-x-auto whitespace-nowrap' aria-label='Breadcrumb'>
      <ol className='flex items-center space-x-2 text-sm font-medium text-gray-500'>
        <li className='flex items-center'>
          <Link to='/' className='hover:text-blue-600 transition-colors flex items-center gap-1'>
            <Home className='w-4 h-4' />
            <span className='sr-only'>Home</span>
          </Link>
        </li>

        {items.map((item, index) => (
          <li key={index} className='flex items-center'>
            <ChevronRight className='w-4 h-4 text-gray-400 mx-1 flex-shrink-0' />
            {item.to ? (
              <Link to={item.to} className='hover:text-blue-600 transition-colors'>
                {item.label}
              </Link>
            ) : (
              <span className='text-gray-900 font-bold' aria-current='page'>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
