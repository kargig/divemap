import { Dropdown, Drawer, Menu as AntMenu, ConfigProvider } from 'antd';
import {
  Menu as MenuIcon,
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
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useResponsiveScroll } from '../hooks/useResponsive';

import GlobalSearchBar from './GlobalSearchBar';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, navbarVisible } = useResponsiveScroll();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
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
              <Home className='h-6 w-6' />
              <span className='text-sm'>Home</span>
            </Link>

            <Link
              to='/map'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <MapPin className='h-6 w-6' />
              <span className='text-sm'>Map</span>
            </Link>

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'dive-log',
                    label: 'Dive Log',
                    icon: <Anchor className='h-4 w-4' />,
                    onClick: () => navigate('/dives'),
                  },
                  {
                    key: 'dive-sites',
                    label: 'Dive Sites',
                    icon: <Map className='h-4 w-4' />,
                    onClick: () => navigate('/dive-sites'),
                  },
                  {
                    key: 'dive-routes',
                    label: 'Dive Routes',
                    icon: <Route className='h-4 w-4' />,
                    onClick: () => navigate('/dive-routes'),
                  },
                ],
              }}
              trigger={['click']}
              placement='bottomRight'
            >
              <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                <Compass className='h-6 w-6' />
                <span className='text-sm'>Diving</span>
                <ChevronDown className='h-4 w-4' />
              </button>
            </Dropdown>

            <Link
              to='/diving-centers'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Building className='h-6 w-6' />
              <span className='text-sm'>Diving Centers</span>
            </Link>

            <Link
              to='/dive-trips'
              className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
            >
              <Calendar className='h-6 w-6' />
              <span className='text-sm'>Dive Trips</span>
            </Link>

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'diving-organizations',
                    label: 'Diving Organizations',
                    icon: <Award className='h-4 w-4' />,
                    onClick: () => navigate('/resources/diving-organizations'),
                  },
                  {
                    key: 'tools',
                    label: 'Tools',
                    icon: <Calculator className='h-4 w-4' />,
                    onClick: () => navigate('/resources/tools'),
                  },
                  {
                    key: 'tags',
                    label: 'Tags',
                    icon: <Tags className='h-4 w-4' />,
                    onClick: () => navigate('/resources/tags'),
                  },
                ],
              }}
              trigger={['click']}
              placement='bottomRight'
            >
              <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                <Award className='h-6 w-6' />
                <span className='text-sm'>Resources</span>
                <ChevronDown className='h-4 w-4' />
              </button>
            </Dropdown>

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'about',
                    label: 'About',
                    icon: <Info className='h-4 w-4' />,
                    onClick: () => navigate('/about'),
                  },
                  {
                    key: 'api-docs',
                    label: 'API',
                    icon: <Code className='h-4 w-4' />,
                    onClick: () => navigate('/api-docs'),
                  },
                  {
                    key: 'changelog',
                    label: 'Changelog',
                    icon: <FileText className='h-4 w-4' />,
                    onClick: () => navigate('/changelog'),
                  },
                  {
                    key: 'help',
                    label: 'Help',
                    icon: <HelpCircle className='h-4 w-4' />,
                    onClick: () => navigate('/help'),
                  },
                  {
                    key: 'privacy',
                    label: 'Privacy',
                    icon: <Shield className='h-4 w-4' />,
                    onClick: () => navigate('/privacy'),
                  },
                ],
              }}
              trigger={['click']}
              placement='bottomRight'
            >
              <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                <Info className='h-6 w-6' />
                <span className='text-sm'>Info</span>
                <ChevronDown className='h-4 w-4' />
              </button>
            </Dropdown>

            {user ? (
              <div className='flex items-center space-x-4'>
                <NotificationBell />

                {user.is_admin && (
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'dashboard',
                          label: 'Dashboard',
                          icon: <Settings className='h-4 w-4' />,
                          onClick: () => navigate('/admin'),
                        },
                        {
                          key: 'dives',
                          label: 'Dives',
                          icon: <Anchor className='h-4 w-4' />,
                          onClick: () => navigate('/admin/dives'),
                        },
                        {
                          key: 'dive-sites',
                          label: 'Dive Sites',
                          icon: <MapPin className='h-4 w-4' />,
                          onClick: () => navigate('/admin/dive-sites'),
                        },
                        {
                          key: 'diving-centers',
                          label: 'Diving Centers',
                          icon: <Building className='h-4 w-4' />,
                          onClick: () => navigate('/admin/diving-centers'),
                        },
                        {
                          key: 'diving-organizations',
                          label: 'Diving Organizations',
                          icon: <Award className='h-4 w-4' />,
                          onClick: () => navigate('/admin/diving-organizations'),
                        },
                        {
                          key: 'tags',
                          label: 'Tags',
                          icon: <Tags className='h-4 w-4' />,
                          onClick: () => navigate('/admin/tags'),
                        },
                        {
                          key: 'newsletters',
                          label: 'Newsletters',
                          icon: <FileText className='h-4 w-4' />,
                          onClick: () => navigate('/admin/newsletters'),
                        },
                        {
                          key: 'ownership-requests',
                          label: 'Ownership Requests',
                          icon: <Crown className='h-4 w-4' />,
                          onClick: () => navigate('/admin/ownership-requests'),
                        },
                        {
                          key: 'system-metrics',
                          label: 'System Metrics',
                          icon: <Activity className='h-4 w-4' />,
                          onClick: () => navigate('/admin/system-metrics'),
                        },
                        {
                          key: 'general-statistics',
                          label: 'General Statistics',
                          icon: <BarChart3 className='h-4 w-4' />,
                          onClick: () => navigate('/admin/general-statistics'),
                        },
                        {
                          key: 'growth-visualizations',
                          label: 'Growth Visualizations',
                          icon: <BarChart3 className='h-4 w-4' />,
                          onClick: () => navigate('/admin/growth-visualizations'),
                        },
                        {
                          key: 'recent-activity',
                          label: 'Recent Activity',
                          icon: <Clock className='h-4 w-4' />,
                          onClick: () => navigate('/admin/recent-activity'),
                        },
                        {
                          key: 'users',
                          label: 'Users',
                          icon: <Users className='h-4 w-4' />,
                          onClick: () => navigate('/admin/users'),
                        },
                        {
                          key: 'notification-preferences',
                          label: 'Notification Preferences',
                          icon: <Bell className='h-4 w-4' />,
                          onClick: () => navigate('/admin/notification-preferences'),
                        },
                      ],
                    }}
                    trigger={['click']}
                    placement='bottomRight'
                  >
                    <button className='flex items-center space-x-1 hover:text-blue-200 transition-colors'>
                      <Settings className='h-6 w-6' />
                      <span className='text-sm'>Admin</span>
                      <ChevronDown className='h-4 w-4' />
                    </button>
                  </Dropdown>
                )}

                <Link
                  to='/profile'
                  className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
                >
                  <User className='h-6 w-6' />
                  <span className='text-sm'>{user.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className='flex items-center space-x-1 hover:text-blue-200 transition-colors'
                >
                  <LogOut className='h-6 w-6' />
                  <span className='text-sm'>Logout</span>
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
          <div className='md:hidden flex items-center gap-4'>
            {user && <NotificationBell />}
            <button
              onClick={toggleMobileMenu}
              className='text-white hover:text-blue-200 transition-colors'
              aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
            >
              {isMobileMenuOpen ? <X className='h-6 w-6' /> : <MenuIcon className='h-6 w-6' />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <ConfigProvider
          theme={{
            components: {
              Drawer: {
                colorBgElevated: '#1e40af', // blue-700
                colorText: 'white',
              },
              Menu: {
                colorItemBg: '#1e40af',
                colorItemText: 'white',
                colorItemTextHover: '#bfdbfe', // blue-200
                colorItemBgHover: '#1e3a8a', // darker blue
                colorItemTextSelected: 'white',
                colorItemBgSelected: '#1e3a8a',
                colorSubItemBg: '#172554', // blue-950
              },
            },
          }}
        >
          <Drawer
            title={
              <div className='flex items-center gap-2'>
                <Logo size='small' showText={true} textOnly={false} textClassName='text-white' />
              </div>
            }
            placement='right'
            onClose={closeMobileMenu}
            open={isMobileMenuOpen}
            closable={false}
            extra={
              <button
                onClick={closeMobileMenu}
                className='text-white hover:text-blue-200 transition-colors p-1'
                aria-label='Close menu'
              >
                <X className='h-6 w-6' />
              </button>
            }
            size='85%'
            styles={{
              header: { borderBottom: '1px solid rgba(255,255,255,0.1)' },
              body: { padding: 0 },
              mask: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
            }}
          >
            <div className='flex flex-col h-full'>
              <div className='p-4 border-b border-white/10'>
                <GlobalSearchBar
                  className='w-full'
                  inputClassName='bg-white text-gray-900'
                  placeholder='Search dives, sites, centers...'
                  popoverClassName='z-[100000]'
                />
              </div>

              <div className='flex-1 overflow-y-auto'>
                <AntMenu
                  mode='inline'
                  onClick={({ key }) => {
                    if (key) {
                      navigate(key);
                      closeMobileMenu();
                    }
                  }}
                  items={[
                    {
                      key: '/',
                      icon: <Home className='h-5 w-5' />,
                      label: 'Home',
                    },
                    {
                      key: '/map',
                      icon: <MapPin className='h-5 w-5' />,
                      label: 'Map',
                    },
                    {
                      key: 'sub-diving',
                      icon: <Compass className='h-5 w-5' />,
                      label: 'Diving',
                      children: [
                        {
                          key: '/dives',
                          icon: <Anchor className='h-4 w-4' />,
                          label: 'Dive Log',
                        },
                        {
                          key: '/dive-sites',
                          icon: <Map className='h-4 w-4' />,
                          label: 'Dive Sites',
                        },
                        {
                          key: '/dive-routes',
                          icon: <Route className='h-4 w-4' />,
                          label: 'Dive Routes',
                        },
                      ],
                    },
                    {
                      key: '/diving-centers',
                      icon: <Building className='h-5 w-5' />,
                      label: 'Diving Centers',
                    },
                    {
                      key: '/dive-trips',
                      icon: <Calendar className='h-5 w-5' />,
                      label: 'Dive Trips',
                    },
                    {
                      key: 'sub-resources',
                      icon: <Award className='h-5 w-5' />,
                      label: 'Resources',
                      children: [
                        {
                          key: '/resources/diving-organizations',
                          icon: <Award className='h-4 w-4' />,
                          label: 'Diving Organizations',
                        },
                        {
                          key: '/resources/tools',
                          icon: <Calculator className='h-4 w-4' />,
                          label: 'Tools',
                        },
                        {
                          key: '/resources/tags',
                          icon: <Tags className='h-4 w-4' />,
                          label: 'Tags',
                        },
                      ],
                    },
                    {
                      key: 'sub-info',
                      icon: <Info className='h-5 w-5' />,
                      label: 'Info',
                      children: [
                        {
                          key: '/about',
                          icon: <Info className='h-4 w-4' />,
                          label: 'About',
                        },
                        {
                          key: '/api-docs',
                          icon: <Code className='h-4 w-4' />,
                          label: 'API',
                        },
                        {
                          key: '/changelog',
                          icon: <FileText className='h-4 w-4' />,
                          label: 'Changelog',
                        },
                        {
                          key: '/help',
                          icon: <HelpCircle className='h-4 w-4' />,
                          label: 'Help',
                        },
                        {
                          key: '/privacy',
                          icon: <Shield className='h-4 w-4' />,
                          label: 'Privacy',
                        },
                      ],
                    },
                    ...(user
                      ? [
                          {
                            type: 'divider',
                            style: { borderColor: 'rgba(255,255,255,0.1)' },
                          },
                          {
                            key: '/profile',
                            icon: <User className='h-5 w-5' />,
                            label: user.username,
                          },
                          ...(user.is_admin
                            ? [
                                {
                                  key: 'sub-admin',
                                  icon: <Settings className='h-5 w-5' />,
                                  label: 'Admin',
                                  children: [
                                    {
                                      key: '/admin',
                                      icon: <Settings className='h-4 w-4' />,
                                      label: 'Dashboard',
                                    },
                                    {
                                      key: '/admin/dives',
                                      icon: <Anchor className='h-4 w-4' />,
                                      label: 'Dives',
                                    },
                                    {
                                      key: '/admin/dive-sites',
                                      icon: <MapPin className='h-4 w-4' />,
                                      label: 'Dive Sites',
                                    },
                                    {
                                      key: '/admin/diving-centers',
                                      icon: <Building className='h-4 w-4' />,
                                      label: 'Diving Centers',
                                    },
                                    {
                                      key: '/admin/diving-organizations',
                                      icon: <Award className='h-4 w-4' />,
                                      label: 'Diving Organizations',
                                    },
                                    {
                                      key: '/admin/tags',
                                      icon: <Tags className='h-4 w-4' />,
                                      label: 'Tags',
                                    },
                                    {
                                      key: '/admin/newsletters',
                                      icon: <FileText className='h-4 w-4' />,
                                      label: 'Newsletters',
                                    },
                                    {
                                      key: '/admin/ownership-requests',
                                      icon: <Crown className='h-4 w-4' />,
                                      label: 'Ownership Requests',
                                    },
                                    {
                                      key: '/admin/system-metrics',
                                      icon: <Activity className='h-4 w-4' />,
                                      label: 'System Metrics',
                                    },
                                    {
                                      key: '/admin/general-statistics',
                                      icon: <BarChart3 className='h-4 w-4' />,
                                      label: 'General Statistics',
                                    },
                                    {
                                      key: '/admin/growth-visualizations',
                                      icon: <BarChart3 className='h-4 w-4' />,
                                      label: 'Growth Visualizations',
                                    },
                                    {
                                      key: '/admin/recent-activity',
                                      icon: <Clock className='h-4 w-4' />,
                                      label: 'Recent Activity',
                                    },
                                    {
                                      key: '/admin/users',
                                      icon: <Users className='h-4 w-4' />,
                                      label: 'Users',
                                    },
                                    {
                                      key: '/admin/notification-preferences',
                                      icon: <Bell className='h-4 w-4' />,
                                      label: 'Notification Preferences',
                                    },
                                  ],
                                },
                              ]
                            : []),
                        ]
                      : [
                          {
                            type: 'divider',
                            style: { borderColor: 'rgba(255,255,255,0.1)' },
                          },
                          {
                            key: '/login',
                            label: 'Login',
                            className: 'font-bold',
                          },
                          {
                            key: '/register',
                            label: 'Register',
                          },
                        ]),
                  ]}
                />
              </div>

              {user && (
                <div className='p-4 border-t border-white/10'>
                  <button
                    onClick={() => {
                      handleLogout();
                      closeMobileMenu();
                    }}
                    className='flex items-center w-full px-4 py-2 text-white hover:bg-blue-800 rounded-md transition-colors'
                  >
                    <LogOut className='h-5 w-5 mr-3' />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </Drawer>
        </ConfigProvider>
      </div>
    </nav>
  );
};

export default Navbar;
