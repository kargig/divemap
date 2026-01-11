import React, { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';

import { useResponsiveScroll } from '../hooks/useResponsive';

import Logo from './Logo';

// Lazy load the controls to split bundles
const NavbarDesktopControls = lazy(() => import('./NavbarDesktopControls'));
const NavbarMobileControls = lazy(() => import('./NavbarMobileControls'));

const Navbar = () => {
  const { isMobile, navbarVisible } = useResponsiveScroll();

  return (
    <nav
      className={`text-white shadow-lg fixed top-0 left-0 right-0 z-[60] transition-transform duration-300 ease-in-out ${
        isMobile && !navbarVisible ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{
        backgroundColor: '#2d6b8a',
      }}
    >
      {/* Sea Components Background */}
      <div className='absolute inset-0 pointer-events-none z-0'>
        {/* Shell - positioned on the left side */}
        <div className='absolute left-8 top-2 opacity-60 navbar-sea-component'>
          <img src='/arts/divemap_shell.png' alt='Shell' className='w-8 h-8 object-contain' />
        </div>

        {/* Fish - positioned on the right side */}
        <div className='absolute right-16 top-3 opacity-70 navbar-sea-component'>
          <img src='/arts/divemap_fish.png' alt='Fish' className='w-6 h-6 object-contain' />
        </div>

        {/* Small bubble - positioned near the center */}
        <div className='absolute left-1/4 top-4 opacity-50 navbar-sea-component'>
          <img
            src='/arts/divemap_bubble_small.png'
            alt='Bubble'
            className='w-4 h-4 object-contain'
          />
        </div>

        {/* Coral - positioned more to the left */}
        <div className='absolute left-1/3 top-2 opacity-65 navbar-sea-component'>
          <img src='/arts/divemap_coral.png' alt='Coral' className='w-10 h-10 object-contain' />
        </div>

        {/* Second Shell - positioned next to coral */}
        <div className='absolute left-1/2 top-0 opacity-55 navbar-sea-component'>
          <img src='/arts/divemap_shell.png' alt='Shell 2' className='w-6 h-6 object-contain' />
        </div>

        {/* Additional Small Bubble - near coral */}
        <div className='absolute left-3/5 top-1 opacity-45 navbar-sea-component'>
          <img
            src='/arts/divemap_bubble_small.png'
            alt='Bubble 2'
            className='w-3 h-3 object-contain'
          />
        </div>

        {/* Big Fish - positioned next to coral */}
        <div className='absolute left-2/3 top-0 opacity-75 navbar-sea-component'>
          <img
            src='/arts/divemap_bubble_fish_big.png'
            alt='Big Fish'
            className='w-8 h-8 object-contain'
          />
        </div>

        {/* Additional Big Bubble - right side */}
        <div className='absolute right-8 top-0 opacity-35 navbar-sea-component'>
          <img
            src='/arts/divemap_bubble_big.png'
            alt='Big Bubble 2'
            className='w-5 h-5 object-contain'
          />
        </div>

        {/* Color bubble - positioned on the right */}
        <div className='absolute right-1/3 top-0 opacity-40 navbar-sea-component'>
          <img
            src='/arts/divemap_bubble_color.png'
            alt='Color Bubble'
            className='w-5 h-5 object-contain'
          />
        </div>

        {/* Big bubble - positioned on the left */}
        <div className='absolute left-1/4 top-1 opacity-30 navbar-sea-component'>
          <img
            src='/arts/divemap_bubble_big.png'
            alt='Big Bubble'
            className='w-6 h-6 object-contain'
          />
        </div>
      </div>

      <div className='container mx-auto px-4 relative z-20'>
        <div className='flex justify-between items-center h-16'>
          <Link to='/' className='flex items-center space-x-2'>
            <Logo size='small' showText={true} textOnly={false} textClassName='text-white' />
          </Link>

          <Suspense fallback={<div className='h-10 w-20' />}>
            {isMobile ? <NavbarMobileControls /> : <NavbarDesktopControls />}
          </Suspense>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
