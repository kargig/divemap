import {
  Menu,
  X,
  Home,
  MapPin,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  Settings,
  Crown,
  Activity,
  Clock,
  FileText,
  Info,
  ChevronDown,
  User,
  Map,
  Building,
  Tags,
  Anchor,
  Calendar,
  HelpCircle,
  Shield,
  Code,
  Bell,
  BarChart3,
  Award,
  Calculator,
  Compass,
  Route,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useResponsiveScroll } from '../hooks/useResponsive';

import GlobalSearchBar from './GlobalSearchBar';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import DropdownMenu from './ui/DropdownMenu';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, navbarVisible } = useResponsiveScroll();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMobileDivingDropdown, setShowMobileDivingDropdown] = useState(false);
  const [showMobileResourcesDropdown, setShowMobileResourcesDropdown] = useState(false);
  const [showMobileInfoDropdown, setShowMobileInfoDropdown] = useState(false);
  const [showMobileAdminDropdown, setShowMobileAdminDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setShowMobileDivingDropdown(false);
    setShowMobileResourcesDropdown(false);
    setShowMobileInfoDropdown(false);
    setShowMobileAdminDropdown(false);
  };

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
          <Link to='/' className='flex items-center space-x-2' onClick={closeMobileMenu}>
            <Logo size='small' showText={true} textOnly={false} textClassName='text-white' />
          </Link>

          {/* Desktop Search Bar */}
          <div className='hidden md:flex flex-1 max-w-xl mx-6'>
            <GlobalSearchBar
              className='w-full'
              inputClassName='bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder-gray-300 focus:bg-white focus:text-gray-900'
              placeholder='Search dives, sites, centers...'
            />
          </div>

          {/* Desktop Navigation */}
          <div className='hidden md:flex items-center space-x-6'>
            <Link
              to='/'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Home className='h-5 w-5' />
              <span>Home</span>
            </Link>

            <Link
              to='/map'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <MapPin className='h-5 w-5' />
              <span>Map</span>
            </Link>

            <DropdownMenu
              trigger={
                <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                  <Compass className='h-5 w-5' />
                  <span>Diving</span>
                  <ChevronDown className='h-4 w-4' />
                </button>
              }
              items={[
                {
                  type: 'item',
                  label: 'Dive Log',
                  icon: <Anchor className='h-4 w-4' />,
                  onClick: () => navigate('/dives'),
                },
                {
                  type: 'item',
                  label: 'Dive Sites',
                  icon: <Map className='h-4 w-4' />,
                  onClick: () => navigate('/dive-sites'),
                },
                {
                  type: 'item',
                  label: 'Dive Routes',
                  icon: <Route className='h-4 w-4' />,
                  onClick: () => navigate('/dive-routes'),
                },
              ]}
            />

            <Link
              to='/diving-centers'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Building className='h-5 w-5' />
              <span>Diving Centers</span>
            </Link>

            <Link
              to='/dive-trips'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Calendar className='h-5 w-5' />
              <span>Dive Trips</span>
            </Link>

            <DropdownMenu
              trigger={
                <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                  <Award className='h-5 w-5' />
                  <span>Resources</span>
                  <ChevronDown className='h-4 w-4' />
                </button>
              }
              items={[
                {
                  type: 'item',
                  label: 'Diving Organizations',
                  icon: <Award className='h-4 w-4' />,
                  onClick: () => navigate('/resources/diving-organizations'),
                },
                {
                  type: 'item',
                  label: 'Tools',
                  icon: <Calculator className='h-4 w-4' />,
                  onClick: () => navigate('/resources/tools'),
                },
                {
                  type: 'item',
                  label: 'Tags',
                  icon: <Tags className='h-4 w-4' />,
                  onClick: () => navigate('/resources/tags'),
                },
              ]}
            />

            <DropdownMenu
              trigger={
                <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                  <Info className='h-5 w-5' />
                  <span>Info</span>
                  <ChevronDown className='h-4 w-4' />
                </button>
              }
              items={[
                {
                  type: 'item',
                  label: 'About',
                  icon: <Info className='h-4 w-4' />,
                  onClick: () => navigate('/about'),
                },
                {
                  type: 'item',
                  label: 'API',
                  icon: <Code className='h-4 w-4' />,
                  onClick: () => navigate('/api-docs'),
                },
                {
                  type: 'item',
                  label: 'Changelog',
                  icon: <FileText className='h-4 w-4' />,
                  onClick: () => navigate('/changelog'),
                },
                {
                  type: 'item',
                  label: 'Help',
                  icon: <HelpCircle className='h-4 w-4' />,
                  onClick: () => navigate('/help'),
                },
                {
                  type: 'item',
                  label: 'Privacy',
                  icon: <Shield className='h-4 w-4' />,
                  onClick: () => navigate('/privacy'),
                },
              ]}
            />

            {user ? (
              <div className='flex items-center space-x-4'>
                <NotificationBell />

                {user.is_admin && (
                  <DropdownMenu
                    trigger={
                      <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                        <Settings className='h-5 w-5' />
                        <span>Admin</span>
                        <ChevronDown className='h-4 w-4' />
                      </button>
                    }
                    items={[
                      {
                        type: 'item',
                        label: 'Dashboard',
                        icon: <Settings className='h-4 w-4' />,
                        onClick: () => navigate('/admin'),
                      },
                      {
                        type: 'item',
                        label: 'Dives',
                        icon: <Anchor className='h-4 w-4' />,
                        onClick: () => navigate('/admin/dives'),
                      },
                      {
                        type: 'item',
                        label: 'Dive Sites',
                        icon: <MapPin className='h-4 w-4' />,
                        onClick: () => navigate('/admin/dive-sites'),
                      },
                      {
                        type: 'item',
                        label: 'Diving Centers',
                        icon: <Building className='h-4 w-4' />,
                        onClick: () => navigate('/admin/diving-centers'),
                      },
                      {
                        type: 'item',
                        label: 'Diving Organizations',
                        icon: <Award className='h-4 w-4' />,
                        onClick: () => navigate('/admin/diving-organizations'),
                      },
                      {
                        type: 'item',
                        label: 'Tags',
                        icon: <Tags className='h-4 w-4' />,
                        onClick: () => navigate('/admin/tags'),
                      },
                      {
                        type: 'item',
                        label: 'Newsletters',
                        icon: <FileText className='h-4 w-4' />,
                        onClick: () => navigate('/admin/newsletters'),
                      },
                      {
                        type: 'item',
                        label: 'Ownership Requests',
                        icon: <Crown className='h-4 w-4' />,
                        onClick: () => navigate('/admin/ownership-requests'),
                      },
                      {
                        type: 'item',
                        label: 'System Metrics',
                        icon: <Activity className='h-4 w-4' />,
                        onClick: () => navigate('/admin/system-metrics'),
                      },
                      {
                        type: 'item',
                        label: 'General Statistics',
                        icon: <BarChart3 className='h-4 w-4' />,
                        onClick: () => navigate('/admin/general-statistics'),
                      },
                      {
                        type: 'item',
                        label: 'Growth Visualizations',
                        icon: <BarChart3 className='h-4 w-4' />,
                        onClick: () => navigate('/admin/growth-visualizations'),
                      },
                      {
                        type: 'item',
                        label: 'Recent Activity',
                        icon: <Clock className='h-4 w-4' />,
                        onClick: () => navigate('/admin/recent-activity'),
                      },
                      {
                        type: 'item',
                        label: 'Users',
                        icon: <Users className='h-4 w-4' />,
                        onClick: () => navigate('/admin/users'),
                      },
                      {
                        type: 'item',
                        label: 'Notification Preferences',
                        icon: <Bell className='h-4 w-4' />,
                        onClick: () => navigate('/admin/notification-preferences'),
                      },
                    ]}
                  />
                )}

                <Link
                  to='/profile'
                  className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
                >
                  <User className='h-5 w-5' />
                  <span>{user.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
                >
                  <LogOut className='h-5 w-5' />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className='flex items-center space-x-4'>
                <Link
                  to='/login'
                  className='px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 transition-colors'
                >
                  Login
                </Link>
                <Link
                  to='/register'
                  className='px-4 py-2 rounded-md bg-white text-blue-600 hover:bg-gray-100 transition-colors'
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className='md:hidden'>
            <button
              onClick={toggleMobileMenu}
              className='text-white hover:text-blue-200 transition-colors'
              aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
            >
              {isMobileMenuOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu Overlay - Rendered via Portal */}
        {isMobileMenuOpen &&
          createPortal(
            <>
              {/* Backdrop */}
              <div
                className='fixed inset-0 bg-black bg-opacity-50'
                style={{ zIndex: 99998 }}
                onClick={closeMobileMenu}
              />

              {/* Mobile Menu */}
              <div
                className='fixed top-0 left-0 right-0 bg-blue-700 max-h-screen overflow-y-auto'
                style={{
                  zIndex: 99999,
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: '#1e40af',
                  maxHeight: '100vh',
                  overflowY: 'auto',
                }}
              >
                <div className='px-2 pt-2 pb-3 space-y-1 mobile-menu-container'>
                  {/* Mobile Search Bar with Close Button */}
                  <div className='px-2 mb-3 flex items-center gap-2 relative'>
                    <GlobalSearchBar
                      className='flex-1'
                      inputClassName='bg-white text-gray-900'
                      placeholder='Search dives, sites, centers...'
                      popoverClassName='z-[100000]'
                    />
                    <button
                      onClick={closeMobileMenu}
                      className='flex items-center justify-center w-11 h-11 text-white hover:text-blue-200 hover:bg-blue-800 rounded-lg transition-colors flex-shrink-0 bg-blue-600 border-2 border-white/50 shadow-xl relative'
                      aria-label='Close menu'
                      title='Close menu'
                      style={{ zIndex: 100 }}
                    >
                      <X className='h-7 w-7 stroke-[3]' stroke='white' fill='none' />
                    </button>
                  </div>

                  <Link
                    to='/'
                    className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    onClick={closeMobileMenu}
                  >
                    <Home className='h-5 w-5 mr-3' />
                    <span>Home</span>
                  </Link>

                  <Link
                    to='/map'
                    className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    onClick={closeMobileMenu}
                  >
                    <MapPin className='h-5 w-5 mr-3' />
                    <span>Map</span>
                  </Link>

                  <div className='px-3 py-2'>
                    <button
                      onClick={() => setShowMobileDivingDropdown(!showMobileDivingDropdown)}
                      className='flex items-center justify-between w-full px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    >
                      <div className='flex items-center'>
                        <Compass className='h-5 w-5 mr-3' />
                        <span>Diving</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showMobileDivingDropdown ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showMobileDivingDropdown && (
                      <div className='ml-7 mt-1 space-y-1'>
                        <Link
                          to='/dives'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Anchor className='h-4 w-4 mr-3' />
                          <span>Dive Log</span>
                        </Link>
                        <Link
                          to='/dive-sites'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Map className='h-4 w-4 mr-3' />
                          <span>Dive Sites</span>
                        </Link>
                        <Link
                          to='/dive-routes'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Route className='h-4 w-4 mr-3' />
                          <span>Dive Routes</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  <Link
                    to='/diving-centers'
                    className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    onClick={closeMobileMenu}
                  >
                    <Building className='h-5 w-5 mr-3' />
                    <span>Diving Centers</span>
                  </Link>

                  <Link
                    to='/dive-trips'
                    className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    onClick={closeMobileMenu}
                  >
                    <Calendar className='h-5 w-5 mr-3' />
                    <span>Dive Trips</span>
                  </Link>

                  <div className='px-3 py-2'>
                    <button
                      onClick={() => setShowMobileResourcesDropdown(!showMobileResourcesDropdown)}
                      className='flex items-center justify-between w-full px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    >
                      <div className='flex items-center'>
                        <Award className='h-4 w-4 mr-3' />
                        <span>Resources</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showMobileResourcesDropdown ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showMobileResourcesDropdown && (
                      <div className='ml-7 mt-1 space-y-1'>
                        <Link
                          to='/resources/diving-organizations'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Award className='h-4 w-4 mr-3' />
                          <span>Diving Organizations</span>
                        </Link>
                        <Link
                          to='/resources/tools'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Calculator className='h-4 w-4 mr-3' />
                          <span>Tools</span>
                        </Link>
                        <Link
                          to='/resources/tags'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Tags className='h-4 w-4 mr-3' />
                          <span>Tags</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className='px-3 py-2'>
                    <button
                      onClick={() => setShowMobileInfoDropdown(!showMobileInfoDropdown)}
                      className='flex items-center justify-between w-full px-3 py-2 text-white hover:text-blue-200 transition-colors'
                    >
                      <div className='flex items-center'>
                        <Info className='h-4 w-4 mr-3' />
                        <span>Info</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showMobileInfoDropdown ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showMobileInfoDropdown && (
                      <div className='ml-7 mt-1 space-y-1'>
                        <Link
                          to='/about'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Info className='h-4 w-4 mr-3' />
                          <span>About</span>
                        </Link>
                        <Link
                          to='/api-docs'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Code className='h-4 w-4 mr-3' />
                          <span>API</span>
                        </Link>
                        <Link
                          to='/changelog'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <FileText className='h-4 w-4 mr-3' />
                          <span>Changelog</span>
                        </Link>
                        <Link
                          to='/help'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <HelpCircle className='h-4 w-4 mr-3' />
                          <span>Help</span>
                        </Link>
                        <Link
                          to='/privacy'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <Shield className='h-4 w-4 mr-3' />
                          <span>Privacy</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  {user ? (
                    <>
                      <div className='border-t border-blue-500 pt-2 mt-2'>
                        <Link
                          to='/profile'
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                          onClick={closeMobileMenu}
                        >
                          <User className='h-5 w-5 mr-3' />
                          <span>{user.username}</span>
                        </Link>

                        {user.is_admin && (
                          <div className='px-3 py-2'>
                            <button
                              onClick={() => setShowMobileAdminDropdown(!showMobileAdminDropdown)}
                              className='flex items-center justify-between w-full px-3 py-2 text-white hover:text-blue-200 transition-colors'
                            >
                              <div className='flex items-center'>
                                <Settings className='h-4 w-4 mr-3' />
                                <span>Admin</span>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  showMobileAdminDropdown ? 'rotate-180' : ''
                                }`}
                              />
                            </button>

                            {showMobileAdminDropdown && (
                              <div className='ml-7 mt-1 space-y-1'>
                                <Link
                                  to='/admin'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Settings className='h-4 w-4 mr-3' />
                                  <span>Dashboard</span>
                                </Link>
                                <Link
                                  to='/admin/dives'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Anchor className='h-4 w-4 mr-3' />
                                  <span>Dives</span>
                                </Link>
                                <Link
                                  to='/admin/dive-sites'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <MapPin className='h-4 w-4 mr-3' />
                                  <span>Dive Sites</span>
                                </Link>
                                <Link
                                  to='/admin/diving-centers'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Building className='h-4 w-4 mr-3' />
                                  <span>Diving Centers</span>
                                </Link>
                                <Link
                                  to='/admin/diving-organizations'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Award className='h-4 w-4 mr-3' />
                                  <span>Diving Organizations</span>
                                </Link>
                                <Link
                                  to='/admin/tags'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Tags className='h-4 w-4 mr-3' />
                                  <span>Tags</span>
                                </Link>
                                <Link
                                  to='/admin/newsletters'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <FileText className='h-4 w-4 mr-3' />
                                  <span>Newsletter Management</span>
                                </Link>
                                <Link
                                  to='/admin/ownership-requests'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Crown className='h-4 w-4 mr-3' />
                                  <span>Ownership Requests</span>
                                </Link>
                                <Link
                                  to='/admin/system-metrics'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Activity className='h-4 w-4 mr-3' />
                                  <span>System Metrics</span>
                                </Link>
                                <Link
                                  to='/admin/general-statistics'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <BarChart3 className='h-4 w-4 mr-3' />
                                  <span>General Statistics</span>
                                </Link>
                                <Link
                                  to='/admin/growth-visualizations'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <BarChart3 className='h-4 w-4 mr-3' />
                                  <span>Growth Visualizations</span>
                                </Link>
                                <Link
                                  to='/admin/recent-activity'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Clock className='h-4 w-4 mr-3' />
                                  <span>Recent Activity</span>
                                </Link>
                                <Link
                                  to='/admin/users'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Users className='h-4 w-4 mr-3' />
                                  <span>Users</span>
                                </Link>
                                <Link
                                  to='/admin/notification-preferences'
                                  className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors'
                                  onClick={closeMobileMenu}
                                >
                                  <Bell className='h-4 w-4 mr-3' />
                                  <span>Notification Preferences</span>
                                </Link>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => {
                            handleLogout();
                            closeMobileMenu();
                          }}
                          className='flex items-center px-3 py-2 text-white hover:text-blue-200 transition-colors w-full'
                        >
                          <LogOut className='h-5 w-5 mr-3' />
                          <span>Logout</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className='border-t border-blue-500 pt-2 mt-2 space-y-2'>
                      <Link
                        to='/login'
                        className='block px-3 py-2 text-white hover:text-blue-200 transition-colors'
                        onClick={closeMobileMenu}
                      >
                        Login
                      </Link>
                      <Link
                        to='/register'
                        className='block px-3 py-2 text-white hover:text-blue-200 transition-colors'
                        onClick={closeMobileMenu}
                      >
                        Register
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}
      </div>
    </nav>
  );
};

export default Navbar;
