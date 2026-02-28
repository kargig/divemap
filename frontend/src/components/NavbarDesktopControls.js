import { Dropdown } from 'antd';
import {
  Home,
  MapPin,
  Settings,
  Activity,
  Clock,
  FileText,
  Info,
  ChevronDown,
  User,
  Map,
  MessageSquare,
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
  LogOut,
  Users,
  Crown,
} from 'lucide-react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import { getTotalUnreadChatMessages } from '../api';
import { useAuth } from '../contexts/AuthContext';

import GlobalSearchBar from './GlobalSearchBar';
import NotificationBell from './NotificationBell';

const NavbarDesktopControls = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: unreadChatData } = useQuery('unreadChatCount', getTotalUnreadChatMessages, {
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const unreadChatCount = unreadChatData?.unread_count || 0;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
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
          className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
        >
          <Home className='h-6 w-6' />
          <span className='text-sm'>Home</span>
        </Link>

        <Link
          to='/map'
          className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
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
              {
                key: 'diving-centers',
                label: 'Diving Centers',
                icon: <Building className='h-4 w-4' />,
                onClick: () => navigate('/diving-centers'),
              },
              {
                key: 'dive-trips',
                label: 'Dive Trips',
                icon: <Calendar className='h-4 w-4' />,
                onClick: () => navigate('/dive-trips'),
              },
            ],
          }}
          trigger={['click']}
          placement='bottomRight'
        >
          <button className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'>
            <Compass className='h-6 w-6' />
            <span className='text-sm'>Dive / Explore</span>
            <ChevronDown className='h-4 w-4' />
          </button>
        </Dropdown>

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
          <button className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'>
            <Award className='h-6 w-6' />
            <span className='text-sm'>Resources</span>
            <ChevronDown className='h-4 w-4' />
          </button>
        </Dropdown>

        {user ? (
          <div className='flex items-center space-x-4'>
            <Link
              to='/messages'
              className='flex items-center justify-center p-2 text-white hover:text-blue-200 transition-colors relative'
              title='Messages'
            >
              <MessageSquare className='h-5 w-5' />
              {unreadChatCount > 0 && (
                <span className='absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center min-w-[1rem] translate-x-1/4 -translate-y-1/4'>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </Link>
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
                <button className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'>
                  <Settings className='h-6 w-6' />
                  <span className='text-sm'>Admin</span>
                  <ChevronDown className='h-4 w-4' />
                </button>
              </Dropdown>
            )}

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
              <button
                className='flex items-center text-white hover:text-blue-200 transition-colors'
                title='Info'
              >
                <Info className='h-6 w-6' />
              </button>
            </Dropdown>

            <Link
              to='/profile'
              className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors'
            >
              <User className='h-6 w-6' />
              <span className='text-sm'>{user.username}</span>
            </Link>

            <button
              onClick={handleLogout}
              className='flex items-center text-white hover:text-blue-200 transition-colors ml-2'
              title='Logout'
            >
              <LogOut className='h-6 w-6' />
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
    </>
  );
};

export default NavbarDesktopControls;
